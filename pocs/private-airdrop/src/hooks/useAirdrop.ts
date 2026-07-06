import { useState, useCallback, useRef } from "react";
import { Account, TransactionFinalityStatus, type RpcProvider } from "starknet";
import { SetupRequirement, type PrivateTransfersInterface } from "starknet-sdk";
import type { AppConfig } from "../config.ts";

const WAIT_OPTIONS = {
  successStates: [TransactionFinalityStatus.PRE_CONFIRMED],
  retryInterval: 100,
};

const NOTE_MATURITY_BLOCKS = 10;
const MATURITY_POLL_INTERVAL_MS = 2000;

export type RecipientEntry = {
  address: string;
  amount: bigint;
  status: "pending" | "proving" | "submitted" | "confirmed" | "done" | "failed";
  error?: string;
};

export type AirdropPhase =
  | { phase: "idle" }
  | { phase: "approving" }
  | { phase: "depositing" }
  | { phase: "waiting_maturity"; blocksRemaining: number }
  | { phase: "transferring"; mode: "batch" | "individual"; progress: number }
  | { phase: "complete"; succeeded: number; failed: number }
  | { phase: "error"; message: string };

export type UseAirdropResult = {
  airdropPhase: AirdropPhase;
  recipients: RecipientEntry[];
  executeAirdrop: (entries: Array<{ address: string; amount: bigint }>) => Promise<void>;
  reset: () => void;
};

export function useAirdrop(
  provider: RpcProvider | undefined,
  transfers: PrivateTransfersInterface | undefined,
  adminAddress: string | undefined,
  poolAddress: string,
  config: AppConfig,
  accounts: Array<{ address: string; privateKey: string; admin?: boolean }>,
): UseAirdropResult {
  const [airdropPhase, setPhase] = useState<AirdropPhase>({ phase: "idle" });
  const [recipients, setRecipients] = useState<RecipientEntry[]>([]);
  const cancelledRef = useRef(false);

  const updateRecipientStatus = useCallback(
    (address: string, status: RecipientEntry["status"], error?: string) => {
      setRecipients((prev) =>
        prev.map((r) => (r.address === address ? { ...r, status, error } : r)),
      );
    },
    [],
  );

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setPhase({ phase: "idle" });
    setRecipients([]);
  }, []);

  const executeAirdrop = useCallback(
    async (entries: Array<{ address: string; amount: bigint }>) => {
      if (!provider || !transfers || !adminAddress) {
        setPhase({ phase: "error", message: "Not ready: missing provider, transfers, or admin account" });
        return;
      }

      const senderConfig = accounts.find((a) => a.address === adminAddress);
      if (!senderConfig) {
        setPhase({ phase: "error", message: "Sender account not found" });
        return;
      }

      const adminAccount = new Account({
        provider,
        address: senderConfig.address,
        signer: senderConfig.privateKey,
        cairoVersion: "1",
      });

      cancelledRef.current = false;
      const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0n);

      setRecipients(entries.map(({ address, amount }) => ({
        address,
        amount,
        status: "pending" as const,
      })));

      try {
        // Check existing private balance
        setPhase({ phase: "approving" });
        const { notes: existingNotesMap } = await transfers.discoverNotes({ tokens: [BigInt(config.tokenAddress)] });
        let existingBalance = 0n;
        for (const tokenNotes of existingNotesMap.values()) {
          for (const note of tokenNotes) {
            existingBalance += note.amount ?? 0n;
          }
        }

        const needsDeposit = existingBalance < totalAmount;

        if (needsDeposit) {
          const depositAmount = totalAmount - existingBalance;

          // Step 1: Approve
          const approveCall = {
            contractAddress: config.tokenAddress,
            entrypoint: "approve",
            calldata: [poolAddress, depositAmount.toString(), "0"],
          };
          const approveTx = await adminAccount.execute(approveCall, { tip: 0n });
          await provider.waitForTransaction(approveTx.transaction_hash, WAIT_OPTIONS);

          if (cancelledRef.current) return;

          // Step 2: Deposit
          setPhase({ phase: "depositing" });
          const depositBlockId = (await provider.getBlockNumber()) - 10;
          const { callAndProof: depositResult } = await transfers
            .build({
              autoSetup: true,
              autoDiscover: { notes: "refresh", channels: "refresh" },
            })
            .with(config.tokenAddress, (t) =>
              t.deposit({ amount: depositAmount, recipient: adminAddress }),
            )
            .execute({ provingBlockId: depositBlockId });

          const depositProofDetails = depositResult.proof.proofFacts?.length
            ? { proofFacts: depositResult.proof.proofFacts, proof: depositResult.proof.data }
            : {};

          const depositTx = await adminAccount.execute(depositResult.call, {
            tip: 0n,
            ...depositProofDetails,
          });

          const depositReceipt = await provider.waitForTransaction(
            depositTx.transaction_hash,
            WAIT_OPTIONS,
          );
          if (!depositReceipt.isSuccess()) {
            throw new Error(`Deposit reverted: ${JSON.stringify(depositReceipt)}`);
          }

          const depositBlockNumber = depositReceipt.block_number ?? (await provider.getBlockNumber());

          if (cancelledRef.current) return;

          // Step 3: Wait for note maturity
          let currentBlock = await provider.getBlockNumber();
          let blocksRemaining = Math.max(0, depositBlockNumber + NOTE_MATURITY_BLOCKS - currentBlock);
          setPhase({ phase: "waiting_maturity", blocksRemaining });

          while (blocksRemaining > 0) {
            if (cancelledRef.current) return;
            await new Promise((resolve) => setTimeout(resolve, MATURITY_POLL_INTERVAL_MS));
            currentBlock = await provider.getBlockNumber();
            blocksRemaining = Math.max(0, depositBlockNumber + NOTE_MATURITY_BLOCKS - currentBlock);
            setPhase({ phase: "waiting_maturity", blocksRemaining });
          }
        } else {
          // Already have enough private balance, skip deposit
          setPhase({ phase: "depositing" });
        }

        if (cancelledRef.current) return;

        // Step 4: Batch transfer with explicit channel management
        let batchSucceeded = false;
        setPhase({ phase: "transferring", mode: "batch", progress: 0 });

        try {
          setRecipients((prev) => prev.map((r) => ({ ...r, status: "proving" as const })));

          // Check each recipient's setup requirement to determine what channels need opening.
          // This avoids autoSetup re-opening channels that already exist on-chain.
          const recipientRequirements = new Map<string, import("starknet-sdk").SetupRequirement>();
          for (const { address } of entries) {
            try {
              const requirement = await transfers.discoverRequirement(address, BigInt(config.tokenAddress));
              recipientRequirements.set(address, requirement);
            } catch {
              // If discoverRequirement throws, the sender may not be registered or
              // there's an RPC error. Default to needing full setup.
              recipientRequirements.set(address, SetupRequirement.SetupChannel);
            }
          }

          const provingBlockId = (await provider.getBlockNumber()) - 10;
          const builder = transfers.build({
            autoDiscover: { notes: "refresh" },
            autoSelectNotes: "all",
          });
          builder.surplusTo(adminAddress);

          // Manually add only the setup actions that are actually needed
          for (const { address } of entries) {
            const requirement = recipientRequirements.get(address);
            if (requirement === SetupRequirement.SetupChannel) {
              builder.setup(address);
              builder.with(config.tokenAddress, (t) => t.setup(address));
            } else if (requirement === SetupRequirement.SetupToken) {
              builder.with(config.tokenAddress, (t) => t.setup(address));
            }
          }

          // Add all transfers
          builder.with(config.tokenAddress, (t) => {
            for (const { address, amount } of entries) {
              t.transfer({ recipient: address, amount });
            }
          });

          const { callAndProof: batchResult } = await builder.execute({ provingBlockId });

          setRecipients((prev) => prev.map((r) => ({ ...r, status: "submitted" as const })));

          const batchProofDetails = batchResult.proof.proofFacts?.length
            ? { proofFacts: batchResult.proof.proofFacts, proof: batchResult.proof.data }
            : {};

          const batchTx = await adminAccount.execute(batchResult.call, {
            tip: 0n,
            ...batchProofDetails,
          });

          const batchReceipt = await provider.waitForTransaction(
            batchTx.transaction_hash,
            WAIT_OPTIONS,
          );
          if (!batchReceipt.isSuccess()) {
            throw new Error(`Batch transfer reverted`);
          }

          setRecipients((prev) => prev.map((r) => ({ ...r, status: "done" as const })));
          batchSucceeded = true;
        } catch (batchError) {
          const batchMsg = batchError instanceof Error ? batchError.message : String(batchError);
          console.warn("Batch transfer failed, falling back to individual transfers:", batchMsg);
          setRecipients((prev) => prev.map((r) => ({ ...r, status: "pending" as const, error: `Batch failed: ${batchMsg.slice(0, 120)}` })));
        }

        // Fallback: individual transfers
        // Each transfer uses a completely fresh discovery (like the demo app does)
        // to avoid stale registry data corrupting channel/note encryption.
        if (!batchSucceeded) {
          setPhase({ phase: "transferring", mode: "individual", progress: 0 });
          let completed = 0;
          let lastTransferBlock: number | null = null;

          for (const { address, amount } of entries) {
            if (cancelledRef.current) return;

            // Wait for note maturity from previous transfer's surplus note
            if (lastTransferBlock !== null) {
              let currentBlock = await provider.getBlockNumber();
              let blocksRemaining = Math.max(0, lastTransferBlock + NOTE_MATURITY_BLOCKS - currentBlock);
              if (blocksRemaining > 0) {
                setPhase({ phase: "waiting_maturity", blocksRemaining });
                while (blocksRemaining > 0) {
                  if (cancelledRef.current) return;
                  await new Promise((resolve) => setTimeout(resolve, MATURITY_POLL_INTERVAL_MS));
                  currentBlock = await provider.getBlockNumber();
                  blocksRemaining = Math.max(0, lastTransferBlock + NOTE_MATURITY_BLOCKS - currentBlock);
                  setPhase({ phase: "waiting_maturity", blocksRemaining });
                }
                setPhase({ phase: "transferring", mode: "individual", progress: completed });
              }
            }

            updateRecipientStatus(address, "proving");
            try {
              // Fresh discovery for each transfer - same pattern as the demo app.
              // This ensures channels and notes are accurate for each transfer.
              const provingBlockId = (await provider.getBlockNumber()) - 10;
              const { callAndProof: transferResult } = await transfers
                .build({
                  autoSetup: true,
                  autoDiscover: { notes: "refresh", channels: "refresh" },
                  autoSelectNotes: "naive",
                })
                .surplusTo(adminAddress)
                .with(config.tokenAddress, (t) =>
                  t.transfer({ recipient: address, amount }),
                )
                .execute({ provingBlockId });

              updateRecipientStatus(address, "submitted");

              const transferProofDetails = transferResult.proof.proofFacts?.length
                ? { proofFacts: transferResult.proof.proofFacts, proof: transferResult.proof.data }
                : {};

              const transferTx = await adminAccount.execute(transferResult.call, {
                tip: 0n,
                ...transferProofDetails,
              });

              const transferReceipt = await provider.waitForTransaction(
                transferTx.transaction_hash,
                WAIT_OPTIONS,
              );
              if (!transferReceipt.isSuccess()) {
                throw new Error("Transfer reverted");
              }

              lastTransferBlock = transferReceipt.block_number ?? (await provider.getBlockNumber());
              updateRecipientStatus(address, "done");
            } catch (transferError) {
              const message = transferError instanceof Error ? transferError.message : String(transferError);
              updateRecipientStatus(address, "failed", message);
            }

            completed++;
            setPhase({ phase: "transferring", mode: "individual", progress: completed });
          }
        }

        // Summary
        setRecipients((prev) => {
          const succeeded = prev.filter((r) => r.status === "done").length;
          const failed = prev.filter((r) => r.status === "failed").length;
          setPhase({ phase: "complete", succeeded, failed });
          return prev;
        });
      } catch (topLevelError) {
        const message = topLevelError instanceof Error ? topLevelError.message : String(topLevelError);
        setPhase({ phase: "error", message });
      }
    },
    [provider, transfers, adminAddress, poolAddress, config, accounts, updateRecipientStatus],
  );

  return { airdropPhase, recipients, executeAirdrop, reset };
}
