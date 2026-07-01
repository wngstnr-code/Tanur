#![no_std]
//! TanurYield — holds per-epoch nickel revenue in USDC and pays it out to TANUR
//! holders via a **Merkle claim** (Tanur-Concept §6.1, §13).
//!
//! At fund time the operator snapshots holder balances off-chain, computes each
//! holder's exact USDC entitlement, and commits a Merkle root on-chain. Claims
//! present `(amount, proof)`; the amount is fixed by the snapshot, so moving TANUR
//! during the window cannot change anyone's entitlement — this closes the
//! live-balance "shuffle" gaming that a pro-rata-on-live-balance design allows.
//!
//! Kept separate from the Vault because it custodies funds. KYC is enforced by a
//! cross-contract `is_kyc` read; funding is refused for epochs the Vault never
//! recorded (`epoch_exists`).

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contractmeta,
    contracttype, token::Client as TokenClient, xdr::ToXdr, Address, Bytes, BytesN, Env, Vec,
};

contractmeta!(key = "name", val = "TanurYield");
contractmeta!(key = "binver", val = "0.4.0");
contractmeta!(key = "source", val = "https://github.com/wngstnr-code/Tanur");

const TTL_THRESHOLD: u32 = 17_280;
const TTL_EXTEND: u32 = 518_400;

/// Minimal view of the Vault this contract depends on.
#[contractclient(name = "VaultClient")]
pub trait VaultInterface {
    fn is_kyc(env: Env, account: Address) -> bool;
    fn epoch_exists(env: Env, epoch: u32) -> bool;
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Vault,
    Usdc,
    TanurSac,
    Paused,
    Epoch(u32),
    Claimed(u32, Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EpochInfo {
    pub funded: i128,
    pub claimed: i128,
    /// Merkle root over the (holder, amount) entitlement snapshot.
    pub merkle_root: BytesN<32>,
    pub deadline: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    InvalidAmount = 2,
    EpochNotRecorded = 3,
    AlreadyFunded = 4,
    NotKyc = 5,
    EpochNotFound = 6,
    WindowClosed = 7,
    WindowOpen = 8,
    AlreadyClaimed = 9,
    NothingToClaim = 10,
    Paused = 11,
    Overflow = 12,
    InvalidProof = 13,
    ExceedsFunded = 14,
}

#[contractevent(topics = ["epoch_funded"])]
pub struct EpochFunded {
    pub epoch: u32,
    pub funded: i128,
    pub merkle_root: BytesN<32>,
    pub deadline: u64,
}

#[contractevent(topics = ["claimed"])]
pub struct Claimed {
    pub epoch: u32,
    pub holder: Address,
    pub amount: i128,
}

#[contract]
pub struct TanurYield;

#[contractimpl]
impl TanurYield {
    pub fn __constructor(env: Env, admin: Address, vault: Address, usdc: Address, tanur_sac: Address) {
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Vault, &vault);
        s.set(&DataKey::Usdc, &usdc);
        s.set(&DataKey::TanurSac, &tanur_sac);
    }

    /// Fund an epoch's yield with USDC and commit the entitlement Merkle root.
    /// Refuses epochs the Vault never recorded, and double funding.
    pub fn fund_epoch(
        env: Env,
        funder: Address,
        epoch: u32,
        amount: i128,
        merkle_root: BytesN<32>,
        window_secs: u64,
    ) -> Result<(), Error> {
        funder.require_auth();
        require_not_paused(&env)?;
        bump_instance(&env);
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if env.storage().persistent().has(&DataKey::Epoch(epoch)) {
            return Err(Error::AlreadyFunded);
        }

        // #4 — only fund epochs the oracle actually recorded in the Vault.
        let vault: Address = env
            .storage()
            .instance()
            .get(&DataKey::Vault)
            .ok_or(Error::NotInitialized)?;
        if !VaultClient::new(&env, &vault).epoch_exists(&epoch) {
            return Err(Error::EpochNotRecorded);
        }

        let usdc: Address = env.storage().instance().get(&DataKey::Usdc).unwrap();
        TokenClient::new(&env, &usdc).transfer(&funder, &env.current_contract_address(), &amount);

        let deadline = env.ledger().timestamp() + window_secs;
        let info = EpochInfo {
            funded: amount,
            claimed: 0,
            merkle_root: merkle_root.clone(),
            deadline,
        };
        env.storage().persistent().set(&DataKey::Epoch(epoch), &info);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Epoch(epoch), TTL_THRESHOLD, TTL_EXTEND);

        EpochFunded {
            epoch,
            funded: amount,
            merkle_root,
            deadline,
        }
        .publish(&env);
        Ok(())
    }

    /// Claim a fixed USDC entitlement by presenting a Merkle proof. KYC-gated;
    /// the amount is bound to the snapshot, so token transfers during the window
    /// cannot change it. One claim per (epoch, holder); only inside the window.
    pub fn claim(
        env: Env,
        holder: Address,
        epoch: u32,
        amount: i128,
        proof: Vec<BytesN<32>>,
    ) -> Result<i128, Error> {
        holder.require_auth();
        require_not_paused(&env)?;
        bump_instance(&env);
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let vault: Address = env
            .storage()
            .instance()
            .get(&DataKey::Vault)
            .ok_or(Error::NotInitialized)?;
        if !VaultClient::new(&env, &vault).is_kyc(&holder) {
            return Err(Error::NotKyc);
        }

        let mut info: EpochInfo = env
            .storage()
            .persistent()
            .get(&DataKey::Epoch(epoch))
            .ok_or(Error::EpochNotFound)?;
        if env.ledger().timestamp() > info.deadline {
            return Err(Error::WindowClosed);
        }
        let claim_key = DataKey::Claimed(epoch, holder.clone());
        if env.storage().persistent().get(&claim_key).unwrap_or(false) {
            return Err(Error::AlreadyClaimed);
        }

        // Verify (holder, amount) is in the committed snapshot.
        let leaf = leaf_hash(&env, &holder, amount);
        if !verify_proof(&env, &info.merkle_root, leaf, &proof) {
            return Err(Error::InvalidProof);
        }

        // Defensive: the snapshot sum should equal `funded`; never overpay.
        let new_claimed = info.claimed.checked_add(amount).ok_or(Error::Overflow)?;
        if new_claimed > info.funded {
            return Err(Error::ExceedsFunded);
        }

        let usdc: Address = env.storage().instance().get(&DataKey::Usdc).unwrap();
        TokenClient::new(&env, &usdc).transfer(&env.current_contract_address(), &holder, &amount);

        info.claimed = new_claimed;
        env.storage().persistent().set(&DataKey::Epoch(epoch), &info);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Epoch(epoch), TTL_THRESHOLD, TTL_EXTEND);
        env.storage().persistent().set(&claim_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&claim_key, TTL_THRESHOLD, TTL_EXTEND);

        Claimed {
            epoch,
            holder,
            amount,
        }
        .publish(&env);
        Ok(amount)
    }

    /// Admin: after the window closes, sweep unclaimed USDC back to admin.
    pub fn sweep(env: Env, epoch: u32) -> Result<i128, Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();
        bump_instance(&env);

        let mut info: EpochInfo = env
            .storage()
            .persistent()
            .get(&DataKey::Epoch(epoch))
            .ok_or(Error::EpochNotFound)?;
        if env.ledger().timestamp() <= info.deadline {
            return Err(Error::WindowOpen);
        }
        let remaining = info.funded - info.claimed;
        if remaining <= 0 {
            return Err(Error::NothingToClaim);
        }

        let usdc: Address = env.storage().instance().get(&DataKey::Usdc).unwrap();
        TokenClient::new(&env, &usdc).transfer(&env.current_contract_address(), &admin, &remaining);
        info.claimed = info.funded;
        env.storage().persistent().set(&DataKey::Epoch(epoch), &info);
        Ok(remaining)
    }

    /// Admin: upgrade the contract WASM (SEP-49). Gated by admin auth.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        require_admin(&env)?;
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    /// Admin: pause/unpause fund + claim (emergency control for the USDC vault).
    pub fn set_paused(env: Env, paused: bool) -> Result<(), Error> {
        require_admin(&env)?;
        env.storage().instance().set(&DataKey::Paused, &paused);
        bump_instance(&env);
        Ok(())
    }

    /// Admin: rotate the admin authority.
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), Error> {
        require_admin(&env)?;
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        bump_instance(&env);
        Ok(())
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    pub fn get_epoch_info(env: Env, epoch: u32) -> Result<EpochInfo, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Epoch(epoch))
            .ok_or(Error::EpochNotFound)
    }

    pub fn has_claimed(env: Env, epoch: u32, holder: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Claimed(epoch, holder))
            .unwrap_or(false)
    }
}

/// Leaf = sha256( XDR(ScVal::Address(holder)) ++ XDR(ScVal::I128(amount)) ).
/// The off-chain snapshot tool reproduces this exactly (agents/merkle.py).
fn leaf_hash(env: &Env, holder: &Address, amount: i128) -> BytesN<32> {
    let mut buf: Bytes = holder.clone().to_xdr(env);
    buf.append(&amount.to_xdr(env));
    env.crypto().sha256(&buf).into()
}

/// Verify a Merkle proof using sorted-pair hashing (no direction bits needed):
/// parent = sha256( min(a,b) ++ max(a,b) ).
fn verify_proof(env: &Env, root: &BytesN<32>, leaf: BytesN<32>, proof: &Vec<BytesN<32>>) -> bool {
    let mut computed = leaf;
    for sib in proof.iter() {
        let (a, b) = if computed <= sib {
            (computed.clone(), sib.clone())
        } else {
            (sib.clone(), computed.clone())
        };
        let mut buf = Bytes::from_array(env, &a.to_array());
        buf.append(&Bytes::from_array(env, &b.to_array()));
        computed = env.crypto().sha256(&buf).into();
    }
    &computed == root
}

fn require_admin(env: &Env) -> Result<(), Error> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)?;
    admin.require_auth();
    Ok(())
}

fn require_not_paused(env: &Env) -> Result<(), Error> {
    if env.storage().instance().get(&DataKey::Paused).unwrap_or(false) {
        return Err(Error::Paused);
    }
    Ok(())
}

/// Keep the contract's config (instance storage) from being archived on idle.
fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
}

mod test;
