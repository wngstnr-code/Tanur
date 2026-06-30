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

    # ─── reads (simulation only, no fee) ───

    def get_latest_epoch(self) -> int:
        try:
            return self._simulate_u32("get_latest_epoch")
        except Exception as e:  # noqa: BLE001 — read is best-effort
            log.warning(f"[WRITER] get_latest_epoch read failed ({e}) — assuming 0")
            return 0

    def _simulate(self, fn: str):
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

    def set_gorr(self, gorr_bps: int, admin_secret: str) -> str:
        """Invoke TanurVault.set_gorr (admin-gated). Returns the tx hash."""
        admin = Keypair.from_secret(admin_secret)
        source = self.server.load_account(admin.public_key)
        tx = (
            TransactionBuilder(source, self.passphrase, base_fee=1_000_000)
            .append_invoke_contract_function_op(
                self.vault, "set_gorr", [scval.to_uint32(gorr_bps)]
            )
            .set_timeout(60)
            .build()
        )
        tx = self.server.prepare_transaction(tx)
        tx.sign(admin)
        send = self.server.send_transaction(tx)
        if send.status.name not in ("PENDING", "DUPLICATE", "TRY_AGAIN_LATER"):
            raise RuntimeError(f"send failed: {send.status}")
        for _ in range(30):
            time.sleep(2)
            got = self.server.get_transaction(send.hash)
            if got.status.name == "SUCCESS":
                return send.hash
            if got.status.name == "FAILED":
                raise RuntimeError(f"set_gorr FAILED — tx {send.hash}")
        raise RuntimeError(f"set_gorr not confirmed — tx {send.hash}")

    # ─── write ───

    def record_epoch(
        self,
        epoch: int,
        label: str,
        tonnes: int,
        lme_price_cents: int,
        hpm_price_cents: int,
        score: int,
    ) -> str:
        """Invoke TanurVault.record_epoch (oracle-gated; mints TANUR atomically).

        Returns the transaction hash. Raises on failure.
        """
        params = [
            scval.to_uint32(epoch),
            scval.to_string(label),
            scval.to_int128(tonnes),
            scval.to_int128(lme_price_cents),
            scval.to_int128(hpm_price_cents),
            scval.to_uint32(score),
        ]
        source = self.server.load_account(self.kp.public_key)
        tx = (
            TransactionBuilder(source, self.passphrase, base_fee=1_000_000)
            .append_invoke_contract_function_op(self.vault, "record_epoch", params)
            .set_timeout(60)
            .build()
        )
        tx = self.server.prepare_transaction(tx)  # simulate + assemble resource fees
        tx.sign(self.kp)

        send = self.server.send_transaction(tx)
        if send.status.name not in ("PENDING", "DUPLICATE", "TRY_AGAIN_LATER"):
            raise RuntimeError(f"send failed: {send.status} {send.error_result_xdr}")

        tx_hash = send.hash
        for _ in range(30):
            time.sleep(2)
            got = self.server.get_transaction(tx_hash)
            status = got.status.name
            if status == "SUCCESS":
                return tx_hash
            if status == "FAILED":
                raise RuntimeError(f"record_epoch FAILED on-chain — tx {tx_hash}")
        raise RuntimeError(f"record_epoch not confirmed in time — tx {tx_hash}")
