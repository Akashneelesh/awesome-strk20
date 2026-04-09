import { Account, RpcProvider } from "starknet";
import {
  createPrivateTransfers,
  ProvingServiceProofProvider,
  type PrivateTransfersInterface,
} from "starknet-sdk";
// @ts-expect-error — deep import into dist, not part of the declared exports
import { IndexerDiscoveryProvider } from "starknet-sdk/dist/internal/indexer-discovery.js";
import type { AppConfig, AccountConfig } from "./config.ts";

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
