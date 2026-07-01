"""
Tanur — off-chain Merkle snapshot for KYC-gated yield claims.

Builds the entitlement tree that TanurYield commits to at fund time. The leaf
encoding must match the contract byte-for-byte (tanur-yield `leaf_hash`):

    leaf   = sha256( XDR(ScVal::Address(holder)) || XDR(ScVal::I128(amount)) )
    parent = sha256( min(a, b) || max(a, b) )          # sorted-pair, no direction

`amount` is in USDC stroops (7 decimals). Usage:

    from merkle import build_tree
    root_hex, claims = build_tree([(pubkey, amount_stroops), ...])
    # claims[pubkey] = {"amount": int, "proof": [hex32, ...]}

CLI:
    python merkle.py '[["G...", 600000000], ["G...", 400000000]]'
"""

import hashlib
import json
import sys

from stellar_sdk import scval


def leaf_hash(pubkey: str, amount: int) -> bytes:
    addr_xdr = scval.to_address(pubkey).to_xdr_bytes()
    amt_xdr = scval.to_int128(amount).to_xdr_bytes()
    return hashlib.sha256(addr_xdr + amt_xdr).digest()


def _node(a: bytes, b: bytes) -> bytes:
    lo, hi = (a, b) if a <= b else (b, a)
    return hashlib.sha256(lo + hi).digest()


def build_tree(entries: list[tuple[str, int]], expected_total: int | None = None):
    """Return (root_hex, {pubkey: {"amount", "proof"[hex]}}) for the snapshot.

    Guards: rejects an empty snapshot, duplicate holders (which would make claims
    ambiguous), and non-positive amounts. If `expected_total` is given, asserts the
    entitlements sum to it (i.e. equals the epoch's funded USDC) so no holder is
    short-changed and nothing is left un-sweepable by accident.
    """
    if not entries:
        raise ValueError("empty snapshot")

    pubkeys = [pk for pk, _ in entries]
    if len(set(pubkeys)) != len(pubkeys):
        raise ValueError("duplicate holder in snapshot — entitlements would be ambiguous")
    if any(amt <= 0 for _, amt in entries):
        raise ValueError("non-positive entitlement in snapshot")
    total = sum(amt for _, amt in entries)
    if expected_total is not None and total != expected_total:
        raise ValueError(f"entitlements sum {total} != funded {expected_total}")

    leaves = [leaf_hash(pk, amt) for pk, amt in entries]

    # Proof for each leaf: collect the sibling at every level (sorted-pair tree).
    proofs: list[list[bytes]] = [[] for _ in leaves]
    idx = list(range(len(leaves)))  # indices tracked per original leaf
    level = leaves[:]
    positions = list(range(len(leaves)))  # position of each original leaf in `level`

    while len(level) > 1:
        nxt = []
        nxt_pos = [0] * len(leaves)
        for i in range(0, len(level), 2):
            if i + 1 < len(level):
                left, right = level[i], level[i + 1]
                parent = _node(left, right)
                # every original leaf sitting under i gets sibling right, under i+1 gets left
                for orig in idx:
                    if positions[orig] == i:
                        proofs[orig].append(right)
                    elif positions[orig] == i + 1:
                        proofs[orig].append(left)
            else:
                parent = level[i]  # odd node promoted, no sibling
            for orig in idx:
                if positions[orig] in (i, i + 1):
                    nxt_pos[orig] = len(nxt)
            nxt.append(parent)
        level = nxt
        positions = nxt_pos

    root = level[0]
    claims = {}
    for (pk, amt), proof in zip(entries, proofs):
        claims[pk] = {"amount": amt, "proof": [p.hex() for p in proof]}
    return root.hex(), claims


if __name__ == "__main__":
    entries = json.loads(sys.argv[1])
    entries = [(e[0], int(e[1])) for e in entries]
    expected_total = int(sys.argv[2]) if len(sys.argv) > 2 else None
    root_hex, claims = build_tree(entries, expected_total)
    print(json.dumps({"root": root_hex, "claims": claims}, indent=2))
