#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Env, String};

struct Harness {
    env: Env,
    vault: TanurVaultClient<'static>,
    treasury: Address,
    tanur: token::Client<'static>,
}

fn setup(token_rate: u32, gorr_bps: u32) -> Harness {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    let treasury = Address::generate(&env);
    let issuer = Address::generate(&env);

    // TANUR as a Stellar asset, exposed via its SAC.
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let tanur_sac = sac.address();

    let vault_id = env.register(
        TanurVault,
        (
            admin,
            oracle,
            tanur_sac.clone(),
            treasury.clone(),
            token_rate,
            gorr_bps,
        ),
    );

    // Hand SAC admin to the vault so record_epoch can mint atomically.
    token::StellarAssetClient::new(&env, &tanur_sac).set_admin(&vault_id);

    Harness {
        vault: TanurVaultClient::new(&env, &vault_id),
        treasury,
        tanur: token::Client::new(&env, &tanur_sac),
        env,
    }
}

fn label(env: &Env) -> String {
    String::from_str(env, "2026-06 Morowali")
}

#[test]
fn record_and_mint_atomic() {
    let h = setup(1000, 100); // 1000 TANUR/tonne, GORR 1%
    let minted = h
        .vault
        .record_epoch(&1, &label(&h.env), &5000, &1_600_000, &1_580_000, &90);

    // 5000 × 1000 × 100 / 10_000 = 50_000
    assert_eq!(minted, 50_000);
    assert_eq!(h.tanur.balance(&h.treasury), 50_000);
    assert_eq!(h.vault.get_total_minted(), 50_000);
    assert_eq!(h.vault.get_total_tonnes(), 5000);
    assert_eq!(h.vault.get_oracle_reputation(), 90);
    assert_eq!(h.vault.get_epoch_count(), 1);
    assert_eq!(h.vault.get_latest_epoch(), 1);
}

#[test]
fn reject_low_score() {
    let h = setup(1000, 100);
    let res = h
        .vault
        .try_record_epoch(&1, &label(&h.env), &5000, &1_600_000, &1_580_000, &50);
    assert_eq!(res, Err(Ok(Error::LowScore)));
    assert_eq!(h.tanur.balance(&h.treasury), 0);
}

#[test]
fn reject_duplicate_epoch() {
    let h = setup(1000, 100);
    h.vault
        .record_epoch(&1, &label(&h.env), &5000, &1_600_000, &1_580_000, &90);
    let res = h
        .vault
        .try_record_epoch(&1, &label(&h.env), &4000, &1_600_000, &1_580_000, &90);
    assert_eq!(res, Err(Ok(Error::DuplicateEpoch)));
}

#[test]
fn reject_zero_data() {
    let h = setup(1000, 100);
    let res = h
        .vault
        .try_record_epoch(&1, &label(&h.env), &0, &1_600_000, &1_580_000, &90);
    assert_eq!(res, Err(Ok(Error::ZeroData)));
}

#[test]
fn reputation_is_rolling_average() {
    let h = setup(1000, 100);
    h.vault
        .record_epoch(&1, &label(&h.env), &5000, &1_600_000, &1_580_000, &80);
    assert_eq!(h.vault.get_oracle_reputation(), 80);
    h.vault
        .record_epoch(&2, &label(&h.env), &5000, &1_600_000, &1_580_000, &100);
    // (80 + 100) / 2 = 90
    assert_eq!(h.vault.get_oracle_reputation(), 90);
}

#[test]
fn gorr_clamped_in_constructor_and_setter() {
    let h = setup(1000, 5000); // out-of-band → clamped to 1000
    assert_eq!(h.vault.get_gorr(), 1000);

    assert_eq!(h.vault.set_gorr(&500), 500);
    assert_eq!(h.vault.get_gorr(), 500);

    let too_low = h.vault.try_set_gorr(&50);
    assert_eq!(too_low, Err(Ok(Error::InvalidGorr)));
}

#[test]
fn reject_tonnes_over_cap() {
    let h = setup(1000, 100);
    let res = h.vault.try_record_epoch(
        &1,
        &label(&h.env),
        &1_000_001, // > MAX_TONNES_PER_EPOCH
        &1_600_000,
        &1_580_000,
        &90,
    );
    assert_eq!(res, Err(Ok(Error::TonnesExceedCap)));
    assert_eq!(h.tanur.balance(&h.treasury), 0);
}

#[test]
fn rotate_oracle_and_admin() {
    let h = setup(1000, 100);
    let new_oracle = Address::generate(&h.env);
    let new_admin = Address::generate(&h.env);

    h.vault.set_oracle(&new_oracle);
    assert_eq!(h.vault.get_oracle(), Some(new_oracle));

    h.vault.set_admin(&new_admin);
    assert_eq!(h.vault.get_admin(), Some(new_admin));
}

#[test]
fn kyc_mirror() {
    let h = setup(1000, 100);
    let user = Address::generate(&h.env);
    assert!(!h.vault.is_kyc(&user));
    h.vault.set_kyc(&user, &true);
    assert!(h.vault.is_kyc(&user));
    h.vault.set_kyc(&user, &false);
    assert!(!h.vault.is_kyc(&user));
}
