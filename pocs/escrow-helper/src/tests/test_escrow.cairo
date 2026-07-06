use core::num::traits::Zero;
use escrow::escrow::{
    EscrowOperation, IEscrowDispatcherTrait, IEscrowSafeDispatcherTrait, compute_commitment_hash,
    errors,
};
use openzeppelin::interfaces::token::erc20::IERC20DispatcherTrait;
use privacy::objects::OpenNoteDeposit;
use starkware_utils_testing::test_utils::{assert_panic_with_felt_error, cheat_caller_address_once};

use super::test_utils::{DEFAULT_AMOUNT, DEFAULT_SECRET, EscrowTestEnvTrait, deploy_escrow_test_env};

const NOTE_ID: felt252 = 'NOTE_ID';

#[test]
fn test_deposit_via_privacy_invoke() {
    let env = deploy_escrow_test_env();
    let commitment_hash = compute_commitment_hash(DEFAULT_SECRET);

    env.deposit_as_privacy_contract(:commitment_hash, amount: DEFAULT_AMOUNT);

    // Verify storage.
    let entry = env.dispatcher().get_commitment(:commitment_hash);
    assert_eq!(entry.token, env.token_address());
    assert_eq!(entry.amount, DEFAULT_AMOUNT);
    assert_eq!(entry.claimed, false);

    // Verify tokens are in escrow.
    assert_eq!(env.balance_of(env.escrow_address), DEFAULT_AMOUNT.into());
}

#[test]
fn test_claim_via_privacy_invoke() {
    let env = deploy_escrow_test_env();
    let commitment_hash = compute_commitment_hash(DEFAULT_SECRET);
    env.deposit_as_privacy_contract(:commitment_hash, amount: DEFAULT_AMOUNT);

    let deposits = env.claim_as_privacy_contract(secret: DEFAULT_SECRET, note_id: NOTE_ID);

    // Verify returned deposits.
    assert_eq!(deposits.len(), 1);
    let OpenNoteDeposit { note_id, token, amount } = *deposits[0];
    assert_eq!(note_id, NOTE_ID);
    assert_eq!(token, env.token_address());
    assert_eq!(amount, DEFAULT_AMOUNT);

    // Verify commitment marked as claimed.
    let entry = env.dispatcher().get_commitment(:commitment_hash);
    assert_eq!(entry.claimed, true);

    // Verify escrow approved privacy contract to pull tokens.
    let allowance = env
        .token_dispatcher()
        .allowance(owner: env.escrow_address, spender: env.privacy_contract);
    assert_eq!(allowance, Into::<u128, u256>::into(DEFAULT_AMOUNT));
}

#[test]
fn test_double_claim_fails() {
    let env = deploy_escrow_test_env();
    let commitment_hash = compute_commitment_hash(DEFAULT_SECRET);
    env.deposit_as_privacy_contract(:commitment_hash, amount: DEFAULT_AMOUNT);
    env.claim_as_privacy_contract(secret: DEFAULT_SECRET, note_id: NOTE_ID);

    let result = env.safe_claim_as_privacy_contract(secret: DEFAULT_SECRET, note_id: NOTE_ID);
    assert_panic_with_felt_error(:result, expected_error: errors::ALREADY_CLAIMED);
}

#[test]
fn test_wrong_secret_fails() {
    let env = deploy_escrow_test_env();
    let commitment_hash = compute_commitment_hash(DEFAULT_SECRET);
    env.deposit_as_privacy_contract(:commitment_hash, amount: DEFAULT_AMOUNT);

    let wrong_secret: felt252 = 'WRONG_SECRET';
    let result = env.safe_claim_as_privacy_contract(secret: wrong_secret, note_id: NOTE_ID);
    assert_panic_with_felt_error(:result, expected_error: errors::COMMITMENT_NOT_FOUND);
}

#[test]
fn test_only_pool_can_invoke_deposit() {
    let env = deploy_escrow_test_env();
    let commitment_hash = compute_commitment_hash(DEFAULT_SECRET);
    let non_pool_caller: starknet::ContractAddress = 'ATTACKER'.try_into().unwrap();

    cheat_caller_address_once(contract_address: env.escrow_address, caller_address: non_pool_caller);
    let result = env
        .safe_dispatcher()
        .privacy_invoke(
            operation: EscrowOperation::Deposit,
            :commitment_hash,
            token: env.token_address(),
            amount: DEFAULT_AMOUNT,
            secret: 0,
            note_id: 0,
        );
    assert_panic_with_felt_error(:result, expected_error: errors::CALLER_NOT_PRIVACY);
}

#[test]
fn test_only_pool_can_invoke_claim() {
    let env = deploy_escrow_test_env();
    let commitment_hash = compute_commitment_hash(DEFAULT_SECRET);
    env.deposit_as_privacy_contract(:commitment_hash, amount: DEFAULT_AMOUNT);

    let non_pool_caller: starknet::ContractAddress = 'ATTACKER'.try_into().unwrap();
    cheat_caller_address_once(contract_address: env.escrow_address, caller_address: non_pool_caller);
    let result = env
        .safe_dispatcher()
        .privacy_invoke(
            operation: EscrowOperation::Claim,
            commitment_hash: 0,
            token: Zero::zero(),
            amount: 0,
            secret: DEFAULT_SECRET,
            note_id: NOTE_ID,
        );
    assert_panic_with_felt_error(:result, expected_error: errors::CALLER_NOT_PRIVACY);
}

#[test]
fn test_duplicate_commitment_fails() {
    let env = deploy_escrow_test_env();
    let commitment_hash = compute_commitment_hash(DEFAULT_SECRET);
    env.deposit_as_privacy_contract(:commitment_hash, amount: DEFAULT_AMOUNT);

    let result = env
        .safe_deposit_as_privacy_contract(
            :commitment_hash, token: env.token_address(), amount: DEFAULT_AMOUNT,
        );
    assert_panic_with_felt_error(:result, expected_error: errors::COMMITMENT_EXISTS);
}

#[test]
fn test_deposit_zero_commitment_hash_fails() {
    let env = deploy_escrow_test_env();

    let result = env
        .safe_deposit_as_privacy_contract(
            commitment_hash: 0, token: env.token_address(), amount: DEFAULT_AMOUNT,
        );
    assert_panic_with_felt_error(:result, expected_error: errors::ZERO_COMMITMENT_HASH);
}

#[test]
fn test_deposit_zero_token_fails() {
    let env = deploy_escrow_test_env();
    let commitment_hash = compute_commitment_hash(DEFAULT_SECRET);

    let result = env
        .safe_deposit_as_privacy_contract(
            :commitment_hash, token: Zero::zero(), amount: DEFAULT_AMOUNT,
        );
    assert_panic_with_felt_error(:result, expected_error: errors::ZERO_TOKEN);
}

#[test]
fn test_deposit_zero_amount_fails() {
    let env = deploy_escrow_test_env();
    let commitment_hash = compute_commitment_hash(DEFAULT_SECRET);

    let result = env
        .safe_deposit_as_privacy_contract(
            :commitment_hash, token: env.token_address(), amount: 0,
        );
    assert_panic_with_felt_error(:result, expected_error: errors::ZERO_AMOUNT);
}
