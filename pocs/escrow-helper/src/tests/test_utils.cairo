use core::num::traits::Zero;
use escrow::escrow::{
    Escrow, EscrowOperation, IEscrowDispatcher, IEscrowDispatcherTrait, IEscrowSafeDispatcher,
    IEscrowSafeDispatcherTrait,
};
use openzeppelin::interfaces::token::erc20::IERC20Dispatcher;
use privacy::objects::OpenNoteDeposit;
use snforge_std::{CustomToken, DeclareResultTrait, Token, TokenTrait};
use starknet::deployment::DeploymentParams;
use starknet::{ContractAddress, SyscallResultTrait};
use starkware_utils_testing::test_utils::{
    Deployable, TokenConfig, TokenHelperTrait, cheat_caller_address_once,
};

pub const PRIVACY_CONTRACT: felt252 = 'PRIVACY_CONTRACT';
pub const DEFAULT_AMOUNT: u128 = 1_000_000_000_000_000_000;
pub const DEFAULT_SECRET: felt252 = 'MY_SECRET';

#[derive(Drop, Copy)]
pub struct EscrowTestEnv {
    pub token: Token,
    pub escrow_address: ContractAddress,
    pub privacy_contract: ContractAddress,
}

#[generate_trait]
pub impl EscrowTestEnvImpl of EscrowTestEnvTrait {
    fn dispatcher(self: @EscrowTestEnv) -> IEscrowDispatcher {
        IEscrowDispatcher { contract_address: *self.escrow_address }
    }

    #[feature("safe_dispatcher")]
    fn safe_dispatcher(self: @EscrowTestEnv) -> IEscrowSafeDispatcher {
        IEscrowSafeDispatcher { contract_address: *self.escrow_address }
    }

    fn token_address(self: @EscrowTestEnv) -> ContractAddress {
        self.token.contract_address()
    }

    fn token_dispatcher(self: @EscrowTestEnv) -> IERC20Dispatcher {
        IERC20Dispatcher { contract_address: self.token_address() }
    }

    fn balance_of(self: @EscrowTestEnv, account: ContractAddress) -> u256 {
        self.token.balance_of(address: account)
    }

    /// Fund escrow with tokens and create a commitment as the privacy contract.
    fn deposit_as_privacy_contract(
        self: @EscrowTestEnv, commitment_hash: felt252, amount: u128,
    ) {
        // Fund escrow (simulates the pool's Withdraw/TransferTo step).
        self.token.supply(address: *self.escrow_address, amount: amount);

        cheat_caller_address_once(
            contract_address: *self.escrow_address, caller_address: *self.privacy_contract,
        );
        self
            .dispatcher()
            .privacy_invoke(
                operation: EscrowOperation::Deposit,
                :commitment_hash,
                token: self.token_address(),
                :amount,
                secret: 0,
                note_id: 0,
            );
    }

    /// Call privacy_invoke with Claim as the privacy contract.
    fn claim_as_privacy_contract(
        self: @EscrowTestEnv, secret: felt252, note_id: felt252,
    ) -> Span<OpenNoteDeposit> {
        cheat_caller_address_once(
            contract_address: *self.escrow_address, caller_address: *self.privacy_contract,
        );
        self
            .dispatcher()
            .privacy_invoke(
                operation: EscrowOperation::Claim,
                commitment_hash: 0,
                token: Zero::zero(),
                amount: 0,
                :secret,
                :note_id,
            )
    }

    /// Call privacy_invoke with Claim as the privacy contract (safe dispatcher).
    #[feature("safe_dispatcher")]
    fn safe_claim_as_privacy_contract(
        self: @EscrowTestEnv, secret: felt252, note_id: felt252,
    ) -> Result<Span<OpenNoteDeposit>, Array<felt252>> {
        cheat_caller_address_once(
            contract_address: *self.escrow_address, caller_address: *self.privacy_contract,
        );
        self
            .safe_dispatcher()
            .privacy_invoke(
                operation: EscrowOperation::Claim,
                commitment_hash: 0,
                token: Zero::zero(),
                amount: 0,
                :secret,
                :note_id,
            )
    }

    /// Call privacy_invoke with Deposit as the privacy contract (safe dispatcher).
    #[feature("safe_dispatcher")]
    fn safe_deposit_as_privacy_contract(
        self: @EscrowTestEnv,
        commitment_hash: felt252,
        token: ContractAddress,
        amount: u128,
    ) -> Result<Span<OpenNoteDeposit>, Array<felt252>> {
        cheat_caller_address_once(
            contract_address: *self.escrow_address, caller_address: *self.privacy_contract,
        );
        self
            .safe_dispatcher()
            .privacy_invoke(
                operation: EscrowOperation::Deposit,
                :commitment_hash,
                :token,
                :amount,
                secret: 0,
                note_id: 0,
            )
    }
}

pub fn deploy_escrow_test_env() -> EscrowTestEnv {
    let token = deploy_test_erc20_token();
    let privacy_contract: ContractAddress = PRIVACY_CONTRACT.try_into().unwrap();
    let escrow_address = deploy_escrow(privacy_contract);
    EscrowTestEnv { token, escrow_address, privacy_contract }
}

fn deploy_escrow(privacy_contract: ContractAddress) -> ContractAddress {
    let class_hash = snforge_std::declare(contract: "Escrow")
        .unwrap_syscall()
        .contract_class()
        .class_hash;
    let deployment_params = DeploymentParams { salt: 0, deploy_from_zero: true };
    let (address, _) = Escrow::deploy_for_test(
        class_hash: *class_hash, :deployment_params, :privacy_contract,
    )
        .expect('Escrow deploy failed');
    address
}

fn deploy_test_erc20_token() -> Token {
    let config = TokenConfig {
        name: "EscrowTestToken",
        symbol: "ETT",
        decimals: 18,
        initial_supply: 1_000_000_000_000_000_000_000_000_000_000_u256,
        owner: 'TOKEN_OWNER'.try_into().unwrap(),
    };
    let token = config.deploy();
    Token::Custom(
        CustomToken {
            contract_address: token.address,
            balances_variable_selector: selector!("ERC20_balances"),
        },
    )
}
