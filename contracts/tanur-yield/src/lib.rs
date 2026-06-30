#![no_std]
//! TanurYield — holds per-epoch nickel revenue in USDC and pays it out to TANUR
//! holders, pro-rata, KYC-gated (Tanur-Concept §6.1).
//!
//! Kept separate from the Vault because it custodies funds: isolating the money
//! from the mint/record logic limits blast radius. KYC is enforced by a
//! cross-contract `is_kyc` read against the Vault, so there is a single source of
//! truth for who may hold and claim TANUR.

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contractmeta,
    contracttype, token::Client as TokenClient, Address, BytesN, Env,
};

contractmeta!(key = "name", val = "TanurYield");
contractmeta!(key = "binver", val = "0.2.0");
contractmeta!(key = "source", val = "https://github.com/wngstnr-code/Tanur");

const TTL_THRESHOLD: u32 = 17_280;
const TTL_EXTEND: u32 = 518_400;

/// Minimal view of the Vault this contract depends on.
#[contractclient(name = "VaultClient")]
pub trait VaultInterface {
    fn is_kyc(env: Env, account: Address) -> bool;
    fn get_total_minted(env: Env) -> i128;
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
    /// TANUR supply snapshotted at fund time — the pro-rata denominator.
    pub snapshot_supply: i128,
    pub deadline: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    InvalidAmount = 2,
    EpochNotFunded = 3,
    AlreadyFunded = 4,
    NotKyc = 5,
    EpochNotFound = 6,
    WindowClosed = 7,
    WindowOpen = 8,
    AlreadyClaimed = 9,
    NothingToClaim = 10,
    Paused = 11,
    Overflow = 12,
}

#[contractevent(topics = ["epoch_funded"])]
pub struct EpochFunded {
    pub epoch: u32,
    pub funded: i128,
    pub snapshot_supply: i128,
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

    /// Fund an epoch's yield with USDC and open a claim window of `window_secs`.
    /// Snapshots TANUR supply now so later claims divide against a fixed total.
    pub fn fund_epoch(
        env: Env,
        funder: Address,
        epoch: u32,
        amount: i128,
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

        let usdc: Address = env
            .storage()
            .instance()
            .get(&DataKey::Usdc)
            .ok_or(Error::NotInitialized)?;
        TokenClient::new(&env, &usdc).transfer(
            &funder,
            &env.current_contract_address(),
            &amount,
        );

        let vault: Address = env.storage().instance().get(&DataKey::Vault).unwrap();
        let snapshot_supply = VaultClient::new(&env, &vault).get_total_minted();
        let deadline = env.ledger().timestamp() + window_secs;

        let info = EpochInfo {
            funded: amount,
            claimed: 0,
            snapshot_supply,
            deadline,
        };
        env.storage().persistent().set(&DataKey::Epoch(epoch), &info);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Epoch(epoch), TTL_THRESHOLD, TTL_EXTEND);

        EpochFunded {
            epoch,
            funded: amount,
            snapshot_supply,
            deadline,
        }
        .publish(&env);
        Ok(())
    }

    /// Claim an epoch's USDC share. KYC-gated via the Vault; pays
    /// `funded × holder_TANUR / snapshot_supply`, capped so total claims never
    /// exceed the funded amount, and blocks double claims.
    pub fn claim(env: Env, holder: Address, epoch: u32) -> Result<i128, Error> {
        holder.require_auth();
        require_not_paused(&env)?;
        bump_instance(&env);

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

        let tanur_sac: Address = env.storage().instance().get(&DataKey::TanurSac).unwrap();
        let balance = TokenClient::new(&env, &tanur_sac).balance(&holder);
        if balance <= 0 || info.snapshot_supply <= 0 {
            return Err(Error::NothingToClaim);
        }

        // checked mul/div — overflow fails cleanly instead of panicking.
        let mut share = info
            .funded
            .checked_mul(balance)
            .ok_or(Error::Overflow)?
            / info.snapshot_supply;
        let remaining = info.funded - info.claimed;
        if share > remaining {
            share = remaining;
        }
        if share <= 0 {
            return Err(Error::NothingToClaim);
        }

        let usdc: Address = env.storage().instance().get(&DataKey::Usdc).unwrap();
        TokenClient::new(&env, &usdc).transfer(&env.current_contract_address(), &holder, &share);

        info.claimed += share;
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
            amount: share,
        }
        .publish(&env);
        Ok(share)
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
