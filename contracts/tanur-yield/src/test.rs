#![cfg(test)]
use super::*;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger as _},
    token, vec, Address, Bytes, BytesN, Env, Vec,
};

// Stand-in Vault exposing just the surface TanurYield needs: KYC + epoch_exists.
#[contract]
pub struct MockVault;

#[contractimpl]
impl MockVault {
    pub fn set_kyc(env: Env, account: Address, approved: bool) {
        env.storage().persistent().set(&(1u32, account), &approved);
    }
    pub fn is_kyc(env: Env, account: Address) -> bool {
        env.storage().persistent().get(&(1u32, account)).unwrap_or(false)
    }
    pub fn set_epoch(env: Env, epoch: u32) {
        env.storage().persistent().set(&(2u32, epoch), &true);
    }
    pub fn epoch_exists(env: Env, epoch: u32) -> bool {
        env.storage().persistent().get(&(2u32, epoch)).unwrap_or(false)
    }
}

const FUND: i128 = 10_000;
const A1: i128 = 6_000; // holder1 entitlement
const A2: i128 = 4_000; // holder2 entitlement
const WINDOW: u64 = 1_000;

struct Harness {
    env: Env,
    yield_c: TanurYieldClient<'static>,
    vault: MockVaultClient<'static>,
    usdc: token::Client<'static>,
    admin: Address,
    funder: Address,
    holder1: Address,
    holder2: Address,
    root: BytesN<32>,
    proof1: Vec<BytesN<32>>,
    proof2: Vec<BytesN<32>>,
}

// sorted-pair node hash, matching the contract.
fn node(env: &Env, a: &BytesN<32>, b: &BytesN<32>) -> BytesN<32> {
    let (x, y) = if a <= b { (a, b) } else { (b, a) };
    let mut buf = Bytes::from_array(env, &x.to_array());
    buf.append(&Bytes::from_array(env, &y.to_array()));
    env.crypto().sha256(&buf).into()
}

fn setup() -> Harness {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let funder = Address::generate(&env);
    let holder1 = Address::generate(&env);
    let holder2 = Address::generate(&env);
    let issuer = Address::generate(&env);

    let usdc_sac = env.register_stellar_asset_contract_v2(issuer.clone());
    let tanur_sac = env.register_stellar_asset_contract_v2(issuer);
    token::StellarAssetClient::new(&env, &usdc_sac.address()).mint(&funder, &FUND);

    let vault_id = env.register(MockVault, ());
    let vault = MockVaultClient::new(&env, &vault_id);
    vault.set_kyc(&holder1, &true);
    vault.set_kyc(&holder2, &true); // holder2 KYC'd too; a non-KYC addr is generated per-test
    vault.set_epoch(&1); // epoch 1 recorded in the (mock) vault

    let yield_id = env.register(
        TanurYield,
        (admin.clone(), vault_id, usdc_sac.address(), tanur_sac.address()),
    );

    // Build a 2-leaf Merkle tree over (holder, amount) entitlements.
    let leaf1 = leaf_hash(&env, &holder1, A1);
    let leaf2 = leaf_hash(&env, &holder2, A2);
    let root = node(&env, &leaf1, &leaf2);

    Harness {
        yield_c: TanurYieldClient::new(&env, &yield_id),
        vault,
        usdc: token::Client::new(&env, &usdc_sac.address()),
        admin,
        funder,
        holder1,
        holder2,
        root,
        proof1: vec![&env, leaf2],
        proof2: vec![&env, leaf1],
        env,
    }
}

fn fund(h: &Harness) {
    h.yield_c.fund_epoch(&h.funder, &1, &FUND, &h.root, &WINDOW);
}

#[test]
fn fund_and_merkle_claim() {
    let h = setup();
    fund(&h);
    assert_eq!(h.usdc.balance(&h.yield_c.address), FUND);

    assert_eq!(h.yield_c.claim(&h.holder1, &1, &A1, &h.proof1), A1);
    assert_eq!(h.usdc.balance(&h.holder1), A1);
    assert_eq!(h.yield_c.claim(&h.holder2, &1, &A2, &h.proof2), A2);
    assert_eq!(h.usdc.balance(&h.holder2), A2);
}

#[test]
fn reject_wrong_amount_or_proof() {
    let h = setup();
    fund(&h);
    // right holder, wrong amount → leaf doesn't match the committed root.
    assert_eq!(
        h.yield_c.try_claim(&h.holder1, &1, &9_999, &h.proof1),
        Err(Ok(Error::InvalidProof))
    );
    // right amount, wrong proof (empty).
    assert_eq!(
        h.yield_c.try_claim(&h.holder1, &1, &A1, &Vec::new(&h.env)),
        Err(Ok(Error::InvalidProof))
    );
}

#[test]
fn reject_double_claim() {
    let h = setup();
    fund(&h);
    h.yield_c.claim(&h.holder1, &1, &A1, &h.proof1);
    assert_eq!(
        h.yield_c.try_claim(&h.holder1, &1, &A1, &h.proof1),
        Err(Ok(Error::AlreadyClaimed))
    );
}

#[test]
fn reject_non_kyc() {
    let h = setup();
    fund(&h);
    let stranger = Address::generate(&h.env); // not KYC'd
    assert_eq!(
        h.yield_c.try_claim(&stranger, &1, &A1, &h.proof1),
        Err(Ok(Error::NotKyc))
    );
}

#[test]
fn reject_fund_unrecorded_epoch() {
    let h = setup();
    // epoch 7 was never recorded in the vault.
    assert_eq!(
        h.yield_c.try_fund_epoch(&h.funder, &7, &FUND, &h.root, &WINDOW),
        Err(Ok(Error::EpochNotRecorded))
    );
}

#[test]
fn reject_double_fund() {
    let h = setup();
    fund(&h);
    assert_eq!(
        h.yield_c.try_fund_epoch(&h.funder, &1, &FUND, &h.root, &WINDOW),
        Err(Ok(Error::AlreadyFunded))
    );
}

#[test]
fn pause_blocks_fund_and_claim() {
    let h = setup();
    h.yield_c.set_paused(&true);
    assert_eq!(
        h.yield_c.try_fund_epoch(&h.funder, &1, &FUND, &h.root, &WINDOW),
        Err(Ok(Error::Paused))
    );
    h.yield_c.set_paused(&false);
    fund(&h);
    h.yield_c.set_paused(&true);
    assert_eq!(
        h.yield_c.try_claim(&h.holder1, &1, &A1, &h.proof1),
        Err(Ok(Error::Paused))
    );
    h.yield_c.set_paused(&false);
    assert_eq!(h.yield_c.claim(&h.holder1, &1, &A1, &h.proof1), A1);
}

#[test]
fn sweep_after_window() {
    let h = setup();
    fund(&h);
    h.yield_c.claim(&h.holder1, &1, &A1, &h.proof1); // 6000 out, 4000 remains
    assert_eq!(h.yield_c.try_sweep(&1), Err(Ok(Error::WindowOpen)));
    h.env.ledger().set_timestamp(WINDOW + 1);
    assert_eq!(h.yield_c.sweep(&1), 4_000);
    assert_eq!(h.usdc.balance(&h.admin), 4_000);
}

#[test]
fn claim_after_window_closed() {
    let h = setup();
    fund(&h);
    h.env.ledger().set_timestamp(WINDOW + 1);
    assert_eq!(
        h.yield_c.try_claim(&h.holder1, &1, &A1, &h.proof1),
        Err(Ok(Error::WindowClosed))
    );
}

#[test]
fn rotate_admin() {
    let h = setup();
    let new_admin = Address::generate(&h.env);
    h.yield_c.set_admin(&new_admin);
    h.yield_c.set_paused(&true);
    assert!(h.yield_c.is_paused());
}
