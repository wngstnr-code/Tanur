"""
Tanur — Stellar write/read bridge for the agents.

Builds, simulates, signs, and submits Soroban contract invocations against
TanurVault via stellar-sdk (Tanur-Concept §12). Reads config from
deploy/addresses.json; the oracle's signing seed comes from the ORACLE_SECRET env
var (never committed).
"""

import json
import logging
import os
import time
from pathlib import Path

from stellar_sdk import Keypair, SorobanServer, TransactionBuilder, scval
from stellar_sdk import xdr as stellar_xdr

log = logging.getLogger("stellar-writer")


class StellarWriter:
    def __init__(self, rpc_url: str, passphrase: str, vault: str, explorer: str, secret: str):
        self.server = SorobanServer(rpc_url)
        self.passphrase = passphrase
        self.vault = vault
        self.explorer = explorer
        self.kp = Keypair.from_secret(secret)

    @classmethod
    def from_addresses(cls, addresses_file: Path) -> "StellarWriter":
        cfg = json.loads(Path(addresses_file).read_text())
        secret = os.getenv("ORACLE_SECRET", "")
        if not secret:
            raise RuntimeError("ORACLE_SECRET not set (see agents/.env)")
        return cls(
            rpc_url=os.getenv("RPC_URL", cfg["rpc_url"]),
            passphrase=os.getenv("NETWORK_PASSPHRASE", cfg["network_passphrase"]),
            vault=os.getenv("VAULT_CONTRACT", cfg["contracts"]["vault"]),
            explorer=cfg["explorer"],
            secret=secret,
        )

    # ─── resilience ───

    @staticmethod
    def _retry(fn, label: str, tries: int = 3, delay: float = 2.0):
        """Retry a transient RPC call with linear backoff, then fail loudly."""
        last = None
        for i in range(tries):
            try:
                return fn()
            except Exception as e:  # noqa: BLE001 — transient network/RPC blip
                last = e
                log.warning(f"[WRITER] {label} attempt {i + 1}/{tries} failed: {e}")
                time.sleep(delay * (i + 1))
        raise RuntimeError(f"{label} failed after {tries} tries: {last}")

    # ─── reads (simulation only, no fee) ───

    def get_latest_epoch(self) -> int:
        # #4 — fail hard rather than assume 0: a silent 0 would collide with an
        # existing epoch on-chain (DuplicateEpoch) and confuse the operator.
        return self._simulate_u32("get_latest_epoch")

    def _simulate(self, fn: str):
        def do():
            source = self.server.load_account(self.kp.public_key)
            tx = (
                TransactionBuilder(source, self.passphrase, base_fee=100)
                .append_invoke_contract_function_op(self.vault, fn, [])
                .set_timeout(30)
                .build()
            )
            sim = self.server.simulate_transaction(tx)
            if sim.error or not sim.results:
                raise RuntimeError(sim.error or "no result")
            return stellar_xdr.SCVal.from_xdr(sim.results[0].xdr)

        return self._retry(do, f"simulate {fn}")

    def _simulate_u32(self, fn: str) -> int:
        return scval.from_uint32(self._simulate(fn))

    def _simulate_i128(self, fn: str) -> int:
        return scval.from_int128(self._simulate(fn))

    def read_state(self) -> dict:
        """Read the vault getters the Market Analyst reasons over."""
        return {
            "gorr_bps": self._simulate_u32("get_gorr"),
            "oracle_reputation": self._simulate_u32("get_oracle_reputation"),
            "epoch_count": self._simulate_u32("get_epoch_count"),
            "latest_epoch": self._simulate_u32("get_latest_epoch"),
            "token_rate": self._simulate_u32("get_token_rate"),
            "total_tonnes": self._simulate_i128("get_total_tonnes"),
            "total_minted": self._simulate_i128("get_total_minted"),
        }

    # ─── write ───

    def _invoke_and_confirm(self, fn: str, params: list, signer: Keypair) -> str:
        """Build → simulate/assemble → sign → send (with retry) → poll to SUCCESS.

        Submission is retried on transient failures (the tx isn't broadcast until
        send succeeds, so a rebuild is safe); polling tolerates individual blips.
        Returns the tx hash; raises on on-chain failure or timeout.
        """
        def submit():
            source = self.server.load_account(signer.public_key)
            tx = (
                TransactionBuilder(source, self.passphrase, base_fee=1_000_000)
                .append_invoke_contract_function_op(self.vault, fn, params)
                .set_timeout(60)
                .build()
            )
            tx = self.server.prepare_transaction(tx)  # simulate + assemble fees
            tx.sign(signer)
            return self.server.send_transaction(tx)

        send = self._retry(submit, f"{fn} submit")
        if send.status.name not in ("PENDING", "DUPLICATE", "TRY_AGAIN_LATER"):
            err = getattr(send, "error_result_xdr", "")
            raise RuntimeError(f"{fn} send rejected: {send.status} {err}")

        tx_hash = send.hash
        for _ in range(45):
            time.sleep(2)
            try:
                got = self.server.get_transaction(tx_hash)
            except Exception as e:  # noqa: BLE001 — poll blip, keep waiting
                log.warning(f"[WRITER] poll blip for {tx_hash[:10]} ({e}) — retrying")
                continue
            status = got.status.name
            if status == "SUCCESS":
                return tx_hash
            if status == "FAILED":
                raise RuntimeError(f"{fn} FAILED on-chain — tx {tx_hash}")
        raise RuntimeError(f"{fn} not confirmed in time — tx {tx_hash}")

    def set_gorr(self, gorr_bps: int, admin_secret: str) -> str:
        """Invoke TanurVault.set_gorr (admin-gated). Returns the tx hash."""
        return self._invoke_and_confirm(
            "set_gorr", [scval.to_uint32(gorr_bps)], Keypair.from_secret(admin_secret)
        )

    def record_epoch(
        self,
        epoch: int,
        label: str,
        tonnes: int,
        lme_price_cents: int,
        hpm_price_cents: int,
        score: int,
    ) -> str:
        """Invoke TanurVault.record_epoch (oracle-gated; mints TANUR atomically)."""
        params = [
            scval.to_uint32(epoch),
            scval.to_string(label),
            scval.to_int128(tonnes),
            scval.to_int128(lme_price_cents),
            scval.to_int128(hpm_price_cents),
            scval.to_uint32(score),
        ]
        return self._invoke_and_confirm("record_epoch", params, self.kp)
