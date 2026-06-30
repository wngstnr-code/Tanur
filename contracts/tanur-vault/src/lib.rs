#![no_std]
//! TanurVault — the trust core of Tanur.
//!
//! Combines three jobs that the spec keeps atomic on purpose (Tanur-Concept §6.1):
//!   1. record a verified nickel revenue epoch (oracle-gated),
//!   2. roll the oracle's public reputation score, and
//!   3. mint TANUR straight from the state it just recorded — record + mint in one
//!      transaction, so the operator can never insert a number the data doesn't back.
//!
//! TANUR is a classic Stellar asset exposed through its Stellar Asset Contract (SAC);
//! the Vault is the SAC admin and mints via `StellarAssetClient`. KYC is native
//! (AUTH_REQUIRED trustline authorized by the issuer); this contract mirrors the
//! allow-set so `TanurYield` can gate claims with a cross-contract `is_kyc` read.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contractmeta, contracttype,
    token::StellarAssetClient, Address, BytesN, Env, String,
};

contractmeta!(key = "name", val = "TanurVault");
contractmeta!(key = "binver", val = "0.3.0");
contractmeta!(key = "source", val = "https://github.com/wngstnr-code/Tanur");

/// Minimum cross-validated oracle score (0–100) we accept on-chain.
const MIN_SCORE: u32 = 60;
/// GORR safety band, in basis points — mirrors the AI safety rails (§10).
const MIN_GORR_BPS: u32 = 100; // 1%
const MAX_GORR_BPS: u32 = 1000; // 10%
const BPS_DENOM: i128 = 10_000;
/// Sanity cap on Ni-content per epoch — bounds the blast radius if the oracle
/// key is ever compromised (a single epoch can't mint an absurd supply).
const MAX_TONNES_PER_EPOCH: i128 = 1_000_000;
/// TANUR is a classic Stellar asset with 7 decimals. The tokenomics formula yields
/// a whole-token count; we scale it to the asset's smallest unit (stroops) so that
/// wallets, SDEX, and Horizon display TANUR naturally (1 token = 10^7 stroops).
const TANUR_SCALE: i128 = 10_000_000;

// TTL: ~1 day threshold, extend to ~30 days.
const TTL_THRESHOLD: u32 = 17_280;
const TTL_EXTEND: u32 = 518_400;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Oracle,
    TanurSac,
    Treasury,
    TokenRate,
    GorrBps,
    RepScore,
    RepCount,
    TotalMinted,
    TotalTonnes,
    EpochCount,
    LatestEpoch,
    Epoch(u32),
    Kyc(Address),
}

/// One verified nickel revenue epoch.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EpochRecord {
    pub label: String,
    pub tonnes: i128,
    pub lme_price_cents: i128,
    pub hpm_price_cents: i128,
    pub score: u32,
    pub minted: i128,
    pub gorr_bps: u32,
    pub timestamp: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    LowScore = 2,
    DuplicateEpoch = 3,
    ZeroData = 4,
    InvalidGorr = 5,
    EpochNotFound = 6,
    TonnesExceedCap = 7,
}

#[contractevent(topics = ["epoch_recorded"])]
pub struct EpochRecorded {
    pub epoch: u32,
    pub tonnes: i128,
    pub minted: i128,
    pub score: u32,
    pub reputation: u32,
}

#[contract]
pub struct TanurVault;

#[contractimpl]
impl TanurVault {
    /// Deploy-time init (Protocol 22+ constructor — no front-run window).
    pub fn __constructor(
        env: Env,
        admin: Address,
        oracle: Address,
        tanur_sac: Address,
        treasury: Address,
        token_rate: u32,
        gorr_bps: u32,
    ) {
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Oracle, &oracle);
        s.set(&DataKey::TanurSac, &tanur_sac);
        s.set(&DataKey::Treasury, &treasury);
        s.set(&DataKey::TokenRate, &token_rate);
        s.set(&DataKey::GorrBps, &clamp_gorr(gorr_bps));
        s.set(&DataKey::RepScore, &0u32);
        s.set(&DataKey::RepCount, &0u32);
        s.set(&DataKey::TotalMinted, &0i128);
        s.set(&DataKey::TotalTonnes, &0i128);
        s.set(&DataKey::EpochCount, &0u32);
        s.set(&DataKey::LatestEpoch, &0u32);
    }

    /// Record a verified epoch and atomically mint TANUR from it. Oracle-gated.
    ///
    /// Rejects low oracle scores, duplicate epochs, and zero/negative data. On
    /// success, mints `tonnes × token_rate × gorr_bps / 10_000` TANUR to the
    /// treasury and rolls the oracle's reputation by averaging in this score.
    pub fn record_epoch(
        env: Env,
        epoch: u32,
        label: String,
        tonnes: i128,
        lme_price_cents: i128,
        hpm_price_cents: i128,
        score: u32,
    ) -> Result<i128, Error> {
        let oracle: Address = env
            .storage()
            .instance()
            .get(&DataKey::Oracle)
            .ok_or(Error::NotInitialized)?;
        oracle.require_auth();

        if score < MIN_SCORE {
            return Err(Error::LowScore);
        }
        if tonnes <= 0 || lme_price_cents <= 0 || hpm_price_cents <= 0 {
            return Err(Error::ZeroData);
        }
        if tonnes > MAX_TONNES_PER_EPOCH {
            return Err(Error::TonnesExceedCap);
        }
        if env.storage().persistent().has(&DataKey::Epoch(epoch)) {
            return Err(Error::DuplicateEpoch);
        }

        let token_rate: u32 = env.storage().instance().get(&DataKey::TokenRate).unwrap();
        let gorr_bps: u32 = env.storage().instance().get(&DataKey::GorrBps).unwrap();

        // tonnes × token_rate × gorr_bps / 10_000 whole tokens, scaled to stroops
        // (7-decimal asset). Overflow-checked in release.
        let minted_whole: i128 = tonnes * (token_rate as i128) * (gorr_bps as i128) / BPS_DENOM;
        let minted: i128 = minted_whole * TANUR_SCALE;

        // Atomic mint from the state we just verified — the trust story (§14).
        let tanur_sac: Address = env.storage().instance().get(&DataKey::TanurSac).unwrap();
        let treasury: Address = env.storage().instance().get(&DataKey::Treasury).unwrap();
        StellarAssetClient::new(&env, &tanur_sac).mint(&treasury, &minted);

        // Roll the public reputation score (running average of accepted scores).
        let rep: u32 = env.storage().instance().get(&DataKey::RepScore).unwrap();
        let count: u32 = env.storage().instance().get(&DataKey::RepCount).unwrap();
        let new_count = count + 1;
        let new_rep = ((rep as u64 * count as u64 + score as u64) / new_count as u64) as u32;

        let record = EpochRecord {
            label,
            tonnes,
            lme_price_cents,
            hpm_price_cents,
            score,
            minted,
            gorr_bps,
            timestamp: env.ledger().timestamp(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::Epoch(epoch), &record);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Epoch(epoch), TTL_THRESHOLD, TTL_EXTEND);

        let s = env.storage().instance();
        s.set(&DataKey::RepScore, &new_rep);
        s.set(&DataKey::RepCount, &new_count);
        let total_minted: i128 = s.get(&DataKey::TotalMinted).unwrap();
        s.set(&DataKey::TotalMinted, &(total_minted + minted));
        let total_tonnes: i128 = s.get(&DataKey::TotalTonnes).unwrap();
        s.set(&DataKey::TotalTonnes, &(total_tonnes + tonnes));
        let epoch_count: u32 = s.get(&DataKey::EpochCount).unwrap();
        s.set(&DataKey::EpochCount, &(epoch_count + 1));
        s.set(&DataKey::LatestEpoch, &epoch);
        s.extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        EpochRecorded {
            epoch,
            tonnes,
            minted,
            score,
            reputation: new_rep,
        }
        .publish(&env);

        Ok(minted)
    }

    /// Admin: tune the Gross Overriding Royalty Rate within the [1%, 10%] band.
    /// Used by the closed-loop Market Analyst (stretch) under its own safety rails.
    pub fn set_gorr(env: Env, gorr_bps: u32) -> Result<u32, Error> {
        require_admin(&env)?;
        if !(MIN_GORR_BPS..=MAX_GORR_BPS).contains(&gorr_bps) {
            return Err(Error::InvalidGorr);
        }
        env.storage().instance().set(&DataKey::GorrBps, &gorr_bps);
        Ok(gorr_bps)
    }

    /// Admin: upgrade the contract WASM (SEP-49). Gated by admin auth; the new
    /// hash must already be uploaded via `stellar contract upload`.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        require_admin(&env)?;
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    /// Admin: rotate the oracle authority (e.g. if the oracle key is compromised).
    pub fn set_oracle(env: Env, new_oracle: Address) -> Result<(), Error> {
        require_admin(&env)?;
        env.storage().instance().set(&DataKey::Oracle, &new_oracle);
        Ok(())
    }

    /// Admin: rotate the admin authority.
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), Error> {
        require_admin(&env)?;
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        Ok(())
    }

    /// Admin: mirror the issuer's KYC decision (AUTH_REQUIRED trustline) so the
    /// Yield contract can gate claims via a cross-contract read.
    pub fn set_kyc(env: Env, account: Address, approved: bool) -> Result<(), Error> {
        require_admin(&env)?;
        env.storage()
            .persistent()
            .set(&DataKey::Kyc(account.clone()), &approved);
        env.storage().persistent().extend_ttl(
            &DataKey::Kyc(account),
            TTL_THRESHOLD,
            TTL_EXTEND,
        );
        Ok(())
    }

    pub fn is_kyc(env: Env, account: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Kyc(account))
            .unwrap_or(false)
    }

    pub fn get_oracle_reputation(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::RepScore).unwrap_or(0)
    }

    /// Number of accepted submissions behind the reputation score (transparency).
    pub fn get_submission_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::RepCount).unwrap_or(0)
    }

    pub fn get_oracle(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Oracle)
    }

    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }

    pub fn get_total_minted(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalMinted).unwrap_or(0)
    }

    pub fn get_gorr(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::GorrBps).unwrap_or(0)
    }

    pub fn get_token_rate(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::TokenRate).unwrap_or(0)
    }

    pub fn get_epoch_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::EpochCount).unwrap_or(0)
    }

    pub fn get_total_tonnes(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalTonnes).unwrap_or(0)
    }

    pub fn get_latest_epoch(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::LatestEpoch).unwrap_or(0)
    }

    pub fn get_epoch(env: Env, epoch: u32) -> Result<EpochRecord, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Epoch(epoch))
            .ok_or(Error::EpochNotFound)
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

fn clamp_gorr(gorr_bps: u32) -> u32 {
    gorr_bps.clamp(MIN_GORR_BPS, MAX_GORR_BPS)
}

mod test;
