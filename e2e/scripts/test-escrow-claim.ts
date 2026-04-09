/**
 * Test script for the escrow claim flow.
 *
 * Tests the full flow: Eve (unregistered) claims escrowed tokens using a secret.
 * Uses outsideExecution pattern (same as batch-operations) for proper proof submission.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/test-escrow-claim.ts --secret <hex>
 */

import {
  Account,
  RpcProvider,
  OutsideExecutionVersion,
  type constants,
  type OutsideExecutionOptions,
} from "starknet";
import { IndexerDiscoveryProvider } from "@starkware-libs/starknet-privacy-sdk/testing";
import {
  createPrivateTransfers,
  ProvingServiceProofProvider,
  Open,
  computeCommitmentHash,
} from "@starkware-libs/starknet-privacy-sdk";

interface AccountEntry {
  name: string;
  address: string;
  privateKey: string;
  viewingKey: string;
  admin?: boolean;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const RPC = requireEnv("VITE_RPC_URL");
const TOKEN = requireEnv("VITE_TOKEN_ADDRESS");
const CHAIN_ID = requireEnv("VITE_CHAIN_ID") as constants.StarknetChainId;
const POOL_ADDRESS = requireEnv("VITE_POOL_ADDRESS");
const PROVING_SERVICE_URL = requireEnv("VITE_PROVING_SERVICE_URL");
const INDEXER_URL = requireEnv("VITE_INDEXER_URL");
const ESCROW_ADDRESS = requireEnv("VITE_ESCROW_ADDRESS");
const accounts: AccountEntry[] = JSON.parse(requireEnv("ACCOUNTS"));

// Resource bounds calibrated for Sepolia network gas prices.
const POOL_RESOURCE_BOUNDS = {
  l2_gas: { max_amount: 1_000_000_000n, max_price_per_unit: 100_000_000_000n },
  l1_gas: { max_amount: 100n, max_price_per_unit: 200_000_000_000_000n },
  l1_data_gas: { max_amount: 100_000n, max_price_per_unit: 500_000_000_000n },
};

async function submitOutsideExecution(
  userAccount: Account,
  adminAccount: Account,
  callAndProof: {
    call: unknown;
    proof: { proofFacts?: unknown; data?: unknown };
  },
): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const callOptions: OutsideExecutionOptions = {
    caller: admin!.address,
    execute_after: nowSeconds - 3600,
    execute_before: nowSeconds + 3600,
  };
  const outsideTransaction = await userAccount.getOutsideTransaction(
    callOptions,
    callAndProof.call,
    OutsideExecutionVersion.V2,
  );
  const executeTx = await adminAccount.executeFromOutside(outsideTransaction, {
    tip: 0n,
    resourceBounds: POOL_RESOURCE_BOUNDS,
    proofFacts: callAndProof.proof.proofFacts,
    proof: callAndProof.proof.data,
  });
  const receipt = await provider.waitForTransaction(executeTx.transaction_hash);
  if (!receipt.isSuccess()) {
    console.error("  REVERTED:", JSON.stringify(receipt, null, 2));
    throw new Error(`Transaction reverted: ${executeTx.transaction_hash}`);
  }
  return executeTx.transaction_hash;
}
const PROVING_BLOCK_OFFSET = 10;

// Parse secret from CLI args
const secretArg = process.argv.find((_, i) => process.argv[i - 1] === "--secret");
if (!secretArg) {
  console.error("Usage: npx tsx --env-file=.env scripts/test-escrow-claim.ts --secret <hex>");
  process.exit(1);
}
const secret = BigInt(`0x${secretArg.replace(/^0x/, "")}`);

const admin = accounts.find((a) => a.admin);
if (!admin) throw new Error("No admin account found");

const eve = accounts.find((a) => a.name.toLowerCase().includes("eve"))
  ?? accounts[accounts.length - 1];

console.log(`Account: ${eve.name} (${eve.address})`);
console.log(`Secret: 0x${secret.toString(16)}`);
console.log(`Commitment hash: 0x${computeCommitmentHash(secret).toString(16)}`);

const provider = new RpcProvider({ nodeUrl: RPC });


async function waitForProvingBlock(minBlock: number): Promise<number> {
  let latest = await provider.getBlockNumber();
  while (latest - PROVING_BLOCK_OFFSET < minBlock) {
    const remaining = minBlock - (latest - PROVING_BLOCK_OFFSET);
    process.stdout.write(`  waiting for ${remaining} more blocks...\r`);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    latest = await provider.getBlockNumber();
  }
  return latest - PROVING_BLOCK_OFFSET;
}

async function main() {
  const adminAccount = new Account({
    provider,
    address: admin!.address,
    signer: admin!.privateKey,
    cairoVersion: "1",
  });
  const eveAccount = new Account({
    provider,
    address: eve.address,
    signer: eve.privateKey,
    cairoVersion: "1",
  });

  // Step 1: Verify commitment
  console.log("\n--- Step 1: Verify commitment ---");
  const commitmentHash = computeCommitmentHash(secret);
  const commitResult = await provider.callContract({
    contractAddress: ESCROW_ADDRESS,
    entrypoint: "get_commitment",
    calldata: [commitmentHash.toString()],
  });
  const commitToken = commitResult[0];
  const commitAmount = BigInt(commitResult[1]);
  const claimed = BigInt(commitResult[2]) !== 0n;
  console.log(`  Token: ${commitToken}, Amount: ${commitAmount}, Claimed: ${claimed}`);
  if (commitAmount === 0n || claimed) {
    console.error("  Invalid commitment!");
    process.exit(1);
  }

  // Step 2: Check Eve's registration
  console.log("\n--- Step 2: Check Eve's registration ---");
  const pubKey = await provider.callContract({
    contractAddress: POOL_ADDRESS,
    entrypoint: "get_public_key",
    calldata: [eve.address],
  });
  const isRegistered = BigInt(pubKey[0]) !== 0n;
  console.log(`  Registered: ${isRegistered}`);

  const discovery = new IndexerDiscoveryProvider(INDEXER_URL, POOL_ADDRESS);
  const provingProvider = new ProvingServiceProofProvider(PROVING_SERVICE_URL, CHAIN_ID);

  const transfers = createPrivateTransfers({
    account: eveAccount,
    viewingKeyProvider: { getViewingKey: async () => BigInt(eve.viewingKey) },
    provingProvider,
    discoveryProvider: discovery,
    poolContractAddress: POOL_ADDRESS,
  });

  // Step 3: Register Eve if needed
  if (!isRegistered) {
    console.log("\n--- Step 3: Register Eve ---");
    const provingBlock = await waitForProvingBlock(0);
    console.log(`  Proving block: ${provingBlock}`);

    const regResult = await transfers
      .build({ autoRegister: true })
      .execute({ provingBlockId: provingBlock });

    if (regResult.callAndProof) {
      console.log("  Submitting registration via outsideExecution...");
      const txHash = await submitOutsideExecution(
        eveAccount,
        adminAccount,
        regResult.callAndProof,
      );
      console.log(`  Registration tx: ${txHash}`);
    } else {
      console.log("  No registration needed (already registered or no actions)");
    }

    // Wait for indexer to pick up the registration
    console.log("  Waiting for blocks + indexer...");
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }

  // Step 4a: Test a REGULAR setup (channel only, no notes) to confirm SDK works at all
  console.log("\n--- Step 4a: Test channel setup only ---");
  const setupProvingBlock = await waitForProvingBlock(0);
  console.log(`  Proving block: ${setupProvingBlock}`);

  try {
    console.log("  Building setup only...");
    const setupResult = await transfers
      .build({
        autoSetup: true,
        autoDiscover: { notes: "refresh", channels: "refresh" },
      })
      .setup(eve.address)
      .with(TOKEN)
      .setup(eve.address)
      .execute({ provingBlockId: setupProvingBlock });
    if (setupResult.callAndProof) {
      console.log("  Setup built! Submitting...");
      const txHash = await submitOutsideExecution(eveAccount, adminAccount, setupResult.callAndProof);
      console.log("  Setup tx:", txHash);
      console.log("  Waiting for indexer...");
      await new Promise((resolve) => setTimeout(resolve, 15_000));
    } else {
      console.log("  No setup needed (already done)");
    }
  } catch (error) {
    console.error("  Setup FAILED:", error instanceof Error ? error.message.slice(0, 300) : error);
  }

  // Step 5: Now test WITH invoke
  console.log("\n--- Step 5: Build claim transaction (open note + invoke) ---");
  const claimProvingBlock = await waitForProvingBlock(0);
  console.log(`  Proving block: ${claimProvingBlock}`);

  try {
    const claimResult = await transfers
      .build({
        autoSetup: true,
        autoDiscover: { notes: "refresh", channels: "refresh" },
      })
      .with(TOKEN)
      .transfer({ recipient: eve.address, amount: Open })
      .done()
      .invoke(({ openNotes }) => {
        console.log("  Open notes for invoke:", openNotes);
        return {
          contractAddress: ESCROW_ADDRESS,
          calldata: [
            1, // EscrowOperation::Claim
            0, 0, 0, // commitment_hash, token, amount (unused)
            secret,
            openNotes[0].noteId,
          ],
        };
      })
      .execute({ provingBlockId: claimProvingBlock });

    if (!claimResult.callAndProof) {
      console.error("  No callAndProof returned!");
      process.exit(1);
    }

    console.log("  Submitting claim via outsideExecution...");
    const txHash = await submitOutsideExecution(
      eveAccount,
      adminAccount,
      claimResult.callAndProof,
    );
    console.log(`  Claim tx: ${txHash}`);
  } catch (error) {
    console.error("  Claim build/submit error:", error);
    process.exit(1);
  }

  // Step 5: Verify claim
  console.log("\n--- Step 5: Verify claim ---");
  const finalResult = await provider.callContract({
    contractAddress: ESCROW_ADDRESS,
    entrypoint: "get_commitment",
    calldata: [commitmentHash.toString()],
  });
  console.log(`  Claimed: ${BigInt(finalResult[2]) !== 0n}`);

  // Check Eve's notes
  console.log("  Waiting for discovery...");
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  const notes = await discovery.discoverNotes(
    BigInt(eve.address),
    BigInt(eve.viewingKey),
    { tokens: [BigInt(TOKEN)] },
  );
  const tokenNotes = notes.notes.get(BigInt(TOKEN));
  console.log(`  Eve's notes: ${tokenNotes?.length ?? 0}`);
  if (tokenNotes?.length) {
    for (const note of tokenNotes) {
      console.log(`    amount=${note.amount}, open=${note.open}`);
    }
  }

  console.log("\n=== Done ===");
}

main().catch((error) => {
  // Print concise error — avoid dumping the huge proof blob
  if (error && typeof error === "object" && "baseError" in error) {
    const base = (error as { baseError: { code: number; message: string; data?: unknown } }).baseError;
    console.error("\nFatal RPC error:");
    console.error(`  Code: ${base.code}`);
    console.error(`  Message: ${base.message}`);
    if (base.data) console.error(`  Data: ${JSON.stringify(base.data).slice(0, 500)}`);
  } else {
    console.error("\nFatal:", error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
});
