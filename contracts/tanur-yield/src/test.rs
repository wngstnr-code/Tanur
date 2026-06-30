#![cfg(test)]
use super::*;
use soroban_sdk::{
    contract, contractimpl, symbol_short,
    testutils::{Address as _, Ledger as _},
    token, Address, Env,
};

// A minimal stand-in for TanurVault exposing just the cross-contract surface
// TanurYield depends on — keeps the test decoupled from the vault crate.
#[contract]
pub struct MockVault;

#[contractimpl]
impl MockVault {
    pub fn __constructor(env: Env, total_minted: i128) {
        env.storage()
            .instance()
            .set(&symbol_short!("TOTAL"), &total_minted);
    }
    pub fn set_kyc(env: Env, account: Address, approved: bool) {
        env.storage().persistent().set(&account, &approved);
    }
    pub fn is_kyc(env: Env, account: Address) -> bool {
        env.storage().persistent().get(&account).unwrap_or(false)
    }
    pub fn get_total_minted(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&symbol_short!("TOTAL"))
            .unwrap_or(0)
    }
}

struct Harness {
    env: Env,
    yield_c: TanurYieldClient<'static>,
    vault: MockVaultClient<'static>,
    usdc: token::Client<'static>,
    admin: Address,
    funder: Address,
    holder1: Address,
    holder2: Address,
}

const SUPPLY: i128 = 100_000;
const FUND: i128 = 10_000;
const WINDOW: u64 = 1_000;

fn setup() -> Harness {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let funder = Address::generate(&env);
    let holder1 = Address::generate(&env);
    let holder2 = Address::generate(&env);
    let issuer = Address::generate(&env);

    // USDC + TANUR as Stellar assets.
    let usdc_sac = env.register_stellar_asset_contract_v2(issuer.clone());
    let tanur_sac = env.register_stellar_asset_contract_v2(issuer);
    let usdc_admin = token::StellarAssetClient::new(&env, &usdc_sac.address());
    let tanur_admin = token::StellarAssetClient::new(&env, &tanur_sac.address());

    // TANUR holders: 60k + 40k = 100k total, matching the snapshot supply.
    tanur_admin.mint(&holder1, &60_000);
    tanur_admin.mint(&holder2, &40_000);
    // Funder has USDC to fund the epoch.
    usdc_admin.mint(&funder, &FUND);

    let vault_id = env.register(MockVault, (SUPPLY,));
    let vault = MockVaultClient::new(&env, &vault_id);
    vault.set_kyc(&holder1, &true); // holder2 deliberately left un-KYC'd

    let yield_id = env.register(
        TanurYield,
        (
            admin.clone(),
            vault_id,
            usdc_sac.address(),
            tanur_sac.address(),
        ),
    );

    Harness {
        yield_c: TanurYieldClient::new(&env, &yield_id),
        vault,
        usdc: token::Client::new(&env, &usdc_sac.address()),
        admin,
        funder,
        holder1,
        holder2,
        env,
    }
}

#[test]
fn fund_and_claim_pro_rata() {
    let h = setup();
    h.yield_c.fund_epoch(&h.funder, &1, &FUND, &WINDOW);
    assert_eq!(h.usdc.balance(&h.yield_c.address), FUND);

    // holder1 owns 60k/100k → 60% of 10_000 = 6_000.
    let got = h.yield_c.claim(&h.holder1, &1);
    assert_eq!(got, 6_000);
    assert_eq!(h.usdc.balance(&h.holder1), 6_000);
    assert!(h.yield_c.has_claimed(&1, &h.holder1));
}

#[test]
fn reject_double_claim() {
    let h = setup();
    h.yield_c.fund_epoch(&h.funder, &1, &FUND, &WINDOW);
    h.yield_c.claim(&h.holder1, &1);
    let res = h.yield_c.try_claim(&h.holder1, &1);
    assert_eq!(res, Err(Ok(Error::AlreadyClaimed)));
}

#[test]
fn reject_non_kyc() {
    let h = setup();
    h.yield_c.fund_epoch(&h.funder, &1, &FUND, &WINDOW);
    let res = h.yield_c.try_claim(&h.holder2, &1);
    assert_eq!(res, Err(Ok(Error::NotKyc)));
}

#[test]
fn reject_double_fund() {
    let h = setup();
    h.yield_c.fund_epoch(&h.funder, &1, &FUND, &WINDOW);
    let res = h.yield_c.try_fund_epoch(&h.funder, &1, &FUND, &WINDOW);
    assert_eq!(res, Err(Ok(Error::AlreadyFunded)));
}

#[test]
fn sweep_after_window() {
    let h = setup();
    h.yield_c.fund_epoch(&h.funder, &1, &FUND, &WINDOW);
    h.yield_c.claim(&h.holder1, &1); // 6_000 out, 4_000 remains

    // Window still open → cannot sweep.
    assert_eq!(h.yield_c.try_sweep(&1), Err(Ok(Error::WindowOpen)));

    // Advance past deadline, then sweep the remainder to admin.
    h.env.ledger().set_timestamp(WINDOW + 1);
    let swept = h.yield_c.sweep(&1);
    assert_eq!(swept, 4_000);
    assert_eq!(h.usdc.balance(&h.admin), 4_000);
}

#[test]
fn pause_blocks_fund_and_claim() {
    let h = setup();
    h.yield_c.set_paused(&true);
    // fund is blocked while paused
    assert_eq!(
        h.yield_c.try_fund_epoch(&h.funder, &1, &FUND, &WINDOW),
        Err(Ok(Error::Paused))
    );
    // unpause → fund works
    h.yield_c.set_paused(&false);
    h.yield_c.fund_epoch(&h.funder, &1, &FUND, &WINDOW);
    // pause again → claim blocked
    h.yield_c.set_paused(&true);
    assert_eq!(
        h.yield_c.try_claim(&h.holder1, &1),
        Err(Ok(Error::Paused))
    );
    // unpause → claim works
    h.yield_c.set_paused(&false);
    assert_eq!(h.yield_c.claim(&h.holder1, &1), 6_000);
    assert!(!h.yield_c.is_paused());
}

#[test]
fn rotate_admin() {
    let h = setup();
    let new_admin = Address::generate(&h.env);
    h.yield_c.set_admin(&new_admin);
    // new admin can pause (old path still works because mock_all_auths is on,
    // but this at least exercises the rotation write path)
    h.yield_c.set_paused(&true);
    assert!(h.yield_c.is_paused());
}

#[test]
fn claim_after_window_closed() {
    let h = setup();
    h.yield_c.fund_epoch(&h.funder, &1, &FUND, &WINDOW);
    h.env.ledger().set_timestamp(WINDOW + 1);
    let res = h.yield_c.try_claim(&h.holder1, &1);
    assert_eq!(res, Err(Ok(Error::WindowClosed)));
}
