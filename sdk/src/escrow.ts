/**
 * Escrow utilities for privacy-preserving deferred delivery.
 *
 * Both deposit and claim go through the privacy pool via `privacy_invoke`,
 * so neither Alice nor Bob's address is exposed to the escrow contract.
 *
 * Alice deposits by: using a note, withdrawing tokens to the escrow address,
 * then invoking with the Deposit operation.
 *
 * Bob claims by: creating an open note, then invoking with the Claim operation
 * and the secret Alice shared off-chain.
 */

import type { BigNumberish, CallDetails } from "starknet";
import { hash } from "./utils/crypto.js";
import type { InvokeCalldataBuilderArgs } from "./interfaces.js";

/** Domain-separation tag matching the Cairo contract's ESCROW_COMMITMENT_TAG. */
const ESCROW_COMMITMENT_TAG = "ESCROW_COMMITMENT_TAG:V1";

/**
 * Compute the commitment hash from a secret, matching the Cairo contract's
 * `compute_commitment_hash(secret)` = `poseidon_hash_span([ESCROW_COMMITMENT_TAG, secret])`.
 */
export function computeCommitmentHash(secret: bigint): bigint {
  return hash(ESCROW_COMMITMENT_TAG, secret);
}

/**
 * Generate a random escrow secret (252-bit felt).
 */
export function generateEscrowSecret(): bigint {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

/**
 * Build the `.invoke()` callback for Alice's deposit transaction.
 *
 * Usage with the SDK builder:
 * ```ts
 * await alice.build()
 *   .with(token, t => t
 *     .inputs(aliceNote)
 *     .withdraw({ recipient: escrowAddress, amount }))
 *   .invoke(buildDepositInvoke(escrowAddress, commitmentHash, token, amount))
 *   .execute();
 * ```
 */
export function buildDepositInvoke(
  escrowAddress: BigNumberish,
  commitmentHash: bigint,
  tokenAddress: BigNumberish,
  amount: BigNumberish
): (args: InvokeCalldataBuilderArgs) => CallDetails {
  return () => ({
    contractAddress: String(escrowAddress),
    calldata: [
      0, // EscrowOperation::Deposit variant index
      commitmentHash,
      tokenAddress,
      amount,
      0, // secret (unused)
      0, // note_id (unused)
    ],
  });
}

/**
 * Build the `.invoke()` callback for Bob's claim transaction.
 *
 * Usage with the SDK builder:
 * ```ts
 * await bob.build({ autoRegister: true, autoSetup: true })
 *   .setup(bobAddress)
 *   .with(token, t => t
 *     .setup(bobAddress)
 *     .deposit(Open))
 *   .invoke(buildClaimInvoke(escrowAddress, secret))
 *   .execute();
 * ```
 */
export function buildClaimInvoke(
  escrowAddress: BigNumberish,
  secret: bigint
): (args: InvokeCalldataBuilderArgs) => CallDetails {
  return ({ openNotes }) => ({
    contractAddress: String(escrowAddress),
    calldata: [
      1, // EscrowOperation::Claim variant index
      0, // commitment_hash (unused)
      0, // token (unused)
      0, // amount (unused)
      secret,
      openNotes[0].noteId,
    ],
  });
}

/**
 * Build a claim URL containing the escrow secret.
 */
export function buildClaimUrl(baseUrl: string, secret: bigint): string {
  return `${baseUrl}?secret=${secret.toString(16)}`;
}

/**
 * Parse an escrow secret from a claim URL.
 */
export function parseClaimUrl(url: string): bigint | null {
  try {
    const parsed = new URL(url);
    const secretHex = parsed.searchParams.get("secret");
    if (!secretHex) return null;
    return BigInt(`0x${secretHex}`);
  } catch {
    return null;
  }
}
