import type { constants } from "starknet";

export type AccountConfig = {
  name: string;
  address: string;
  privateKey: string;
  viewingKey: string;
  admin?: boolean;
};

export type RecipientConfig = {
  address: string;
  amount: string;
};

export type AppConfig = {
  rpcUrl: string;
  indexerUrl: string;
  poolAddress: string;
  tokenAddress: string;
  feeTokenAddress: string;
  chainId: constants.StarknetChainId;
  provingServiceUrl?: string;
  proofValidityBlocks: string;
};

function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value as string;
}

export function loadConfig(): AppConfig {
  return {
    rpcUrl: requireEnv("VITE_RPC_URL"),
    indexerUrl: requireEnv("VITE_INDEXER_URL"),
    poolAddress: requireEnv("VITE_POOL_ADDRESS"),
    tokenAddress: requireEnv("VITE_TOKEN_ADDRESS"),
    feeTokenAddress: requireEnv("VITE_FEE_TOKEN_ADDRESS"),
    chainId: requireEnv("VITE_CHAIN_ID") as constants.StarknetChainId,
    provingServiceUrl: import.meta.env.VITE_PROVING_SERVICE_URL as string | undefined,
    proofValidityBlocks: (import.meta.env.VITE_PROOF_VALIDITY_BLOCKS as string) || "450",
  };
}

export function loadRecipients(): RecipientConfig[] {
  const raw = import.meta.env.VITE_AIRDROP_RECIPIENTS as string | undefined;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is RecipientConfig =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.address === "string" &&
        typeof entry.amount === "string",
    );
  } catch {
    return [];
  }
}
