import { Account, RpcProvider, TransactionFinalityStatus } from "starknet";
import {
  createPrivateTransfers,
  IndexerDiscoveryProvider,
  ProvingServiceProofProvider,
  type CallAndProof,
  type PrivateTransfersInterface,
} from "starknet-sdk";
import type { AppConfig, AccountConfig } from "./config.ts";

const WAIT_OPTIONS = {
  successStates: [TransactionFinalityStatus.PRE_CONFIRMED],
  retryInterval: 100,
};

class NoValidateProofProvider {
  constructor(
    private provider: RpcProvider,
    private chainId: string,
  ) {}

  async prove(invocation: unknown) {
    const inv = invocation as {
      invocation: { calldata: string[] };
      details: { nonce: string; version: string; maxFee: string };
    };
    return {
      output: { calldata: inv.invocation.calldata },
      data: [],
      proofFacts: [],
    };
  }
}

export function createProvider(rpcUrl: string): RpcProvider {
  return new RpcProvider({ nodeUrl: rpcUrl });
}

export function createAccount(
  provider: RpcProvider,
  address: string,
  privateKey: string,
): Account {
  return new Account({ provider, address, signer: privateKey, cairoVersion: "1" });
}

export function createTransfers(
  provider: RpcProvider,
  account: Account,
  accountConfig: AccountConfig,
  poolAddress: string,
  config: AppConfig,
): PrivateTransfersInterface {
  const discovery = new IndexerDiscoveryProvider(config.indexerUrl, poolAddress);
  const provingProvider = config.provingServiceUrl
    ? new ProvingServiceProofProvider(config.provingServiceUrl, config.chainId)
    : new NoValidateProofProvider(provider, config.chainId);
  return createPrivateTransfers({
    account,
    viewingKeyProvider: { getViewingKey: async () => BigInt(accountConfig.viewingKey) },
    provingProvider: provingProvider as never,
    discoveryProvider: discovery,
    poolContractAddress: poolAddress,
  });
}

export async function submitPrivateTransaction(
  account: Account,
  provider: RpcProvider,
  callAndProof: CallAndProof,
): Promise<string> {
  const proofDetails = callAndProof.proof.proofFacts?.length
    ? { proofFacts: callAndProof.proof.proofFacts, proof: callAndProof.proof.data }
    : {};

  const tx = await account.execute(callAndProof.call, {
    tip: 0n,
    ...proofDetails,
  });
  const receipt = await provider.waitForTransaction(tx.transaction_hash, WAIT_OPTIONS);
  if (!receipt.isSuccess()) {
    throw new Error(`Transaction reverted: ${JSON.stringify(receipt)}`);
  }
  return tx.transaction_hash;
}

export async function getErc20Balance(
  provider: RpcProvider,
  tokenAddress: string,
  ownerAddress: string,
): Promise<bigint> {
  const result = await provider.callContract({
    contractAddress: tokenAddress,
    entrypoint: "balance_of",
    calldata: [ownerAddress],
  });
  return BigInt(result[0]);
}
