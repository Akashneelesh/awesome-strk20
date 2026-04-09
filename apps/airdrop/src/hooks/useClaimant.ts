import { useState, useCallback } from "react";
import { Account, TransactionFinalityStatus, type RpcProvider } from "starknet";
import { SetupRequirement, type PrivateTransfersInterface, type Note } from "starknet-sdk";
import type { AppConfig } from "../config.ts";

const WAIT_OPTIONS = {
  successStates: [TransactionFinalityStatus.PRE_CONFIRMED],
  retryInterval: 100,
};

export type ClaimantState = {
  notes: Note[];
  totalBalance: bigint;
  discovering: boolean;
  withdrawing: boolean;
  registering: boolean;
  registered: boolean | null;
  lastError: string | null;
  lastTxHash: string | null;
};

export type UseClaimantResult = {
  state: ClaimantState;
  discover: () => Promise<void>;
  withdraw: (amount: bigint) => Promise<void>;
  register: () => Promise<void>;
  checkRegistration: () => Promise<void>;
};

export function useClaimant(
  provider: RpcProvider | undefined,
  transfers: PrivateTransfersInterface | undefined,
  activeAddress: string | undefined,
  poolAddress: string,
  config: AppConfig,
  accounts: Array<{ address: string; privateKey: string }>,
): UseClaimantResult {
  const [state, setState] = useState<ClaimantState>({
    notes: [],
    totalBalance: 0n,
    discovering: false,
    withdrawing: false,
    registering: false,
    registered: null,
    lastError: null,
    lastTxHash: null,
  });

  const discover = useCallback(async () => {
    if (!transfers) return;
    setState((prev) => ({ ...prev, discovering: true, lastError: null }));

    try {
      const { notes: notesMap } = await transfers.discoverNotes({ tokens: [BigInt(config.tokenAddress)] });
      const flatNotes: Note[] = [];
      for (const tokenNotes of notesMap.values()) {
        flatNotes.push(...tokenNotes);
      }
      const totalBalance = flatNotes.reduce((sum, note) => sum + (note.amount ?? 0n), 0n);
      setState((prev) => ({ ...prev, notes: flatNotes, totalBalance, discovering: false }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({ ...prev, discovering: false, lastError: `Discovery failed: ${message}` }));
    }
  }, [transfers, config.tokenAddress]);

  const withdraw = useCallback(
    async (amount: bigint) => {
      if (!provider || !transfers || !activeAddress) return;

      const accountConfig = accounts.find((a) => a.address === activeAddress);
      if (!accountConfig) return;

      const userAccount = new Account({
        provider,
        address: accountConfig.address,
        signer: accountConfig.privateKey,
        cairoVersion: "1",
      });

      setState((prev) => ({ ...prev, withdrawing: true, lastError: null, lastTxHash: null }));

      try {
        const provingBlockId = (await provider.getBlockNumber()) - 10;
        const { callAndProof } = await transfers
          .build({
            autoDiscover: { notes: "refresh", channels: "refresh" },
            autoSelectNotes: "naive",
          })
          .surplusTo(activeAddress)
          .with(config.tokenAddress, (t) =>
            t.withdraw({ amount, recipient: activeAddress }),
          )
          .execute({ provingBlockId });

        const proofDetails = callAndProof.proof.proofFacts?.length
          ? { proofFacts: callAndProof.proof.proofFacts, proof: callAndProof.proof.data }
          : {};

        const tx = await userAccount.execute(callAndProof.call, {
          tip: 0n,
          ...proofDetails,
        });

        const receipt = await provider.waitForTransaction(tx.transaction_hash, WAIT_OPTIONS);
        if (!receipt.isSuccess()) {
          throw new Error(`Withdrawal reverted: ${JSON.stringify(receipt)}`);
        }

        setState((prev) => ({
          ...prev,
          withdrawing: false,
          lastTxHash: tx.transaction_hash,
        }));

        // Re-discover notes after withdrawal
        await discover();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setState((prev) => ({
          ...prev,
          withdrawing: false,
          lastError: `Withdrawal failed: ${message}`,
        }));
      }
    },
    [provider, transfers, activeAddress, config.tokenAddress, accounts, discover],
  );

  const checkRegistration = useCallback(async () => {
    if (!transfers || !activeAddress) return;
    try {
      const requirement = await transfers.discoverRequirement(activeAddress, BigInt(config.tokenAddress));
      setState((prev) => ({ ...prev, registered: requirement !== SetupRequirement.Register }));
    } catch {
      setState((prev) => ({ ...prev, registered: null }));
    }
  }, [transfers, activeAddress, config.tokenAddress]);

  const register = useCallback(async () => {
    if (!provider || !transfers || !activeAddress) return;

    const accountConfig = accounts.find((a) => a.address === activeAddress);
    if (!accountConfig) return;

    const userAccount = new Account({
      provider,
      address: accountConfig.address,
      signer: accountConfig.privateKey,
      cairoVersion: "1",
    });

    setState((prev) => ({ ...prev, registering: true, lastError: null }));

    try {
      const provingBlockId = (await provider.getBlockNumber()) - 10;
      const { callAndProof } = await transfers
        .build()
        .register()
        .execute({ provingBlockId });

      const proofDetails = callAndProof.proof.proofFacts?.length
        ? { proofFacts: callAndProof.proof.proofFacts, proof: callAndProof.proof.data }
        : {};

      const tx = await userAccount.execute(callAndProof.call, {
        tip: 0n,
        ...proofDetails,
      });

      const receipt = await provider.waitForTransaction(tx.transaction_hash, WAIT_OPTIONS);
      if (!receipt.isSuccess()) {
        throw new Error(`Registration reverted: ${JSON.stringify(receipt)}`);
      }

      setState((prev) => ({
        ...prev,
        registering: false,
        registered: true,
        lastTxHash: tx.transaction_hash,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({
        ...prev,
        registering: false,
        lastError: `Registration failed: ${message}`,
      }));
    }
  }, [provider, transfers, activeAddress, accounts]);

  return { state, discover, withdraw, register, checkRegistration };
}
