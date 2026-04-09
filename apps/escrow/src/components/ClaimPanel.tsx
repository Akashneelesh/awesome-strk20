import { useEffect, useState } from "react";
import type { RpcProvider } from "starknet";
import {
  computeCommitmentHash,
  buildClaimInvoke,
  parseClaimUrl,
  type PrivateTransfersInterface,
} from "starknet-sdk";
// Import Open from the SDK's dist directly to ensure symbol identity matches
// the one used internally by the SDK's builder code.
// @ts-expect-error — deep import into dist
import { Open } from "starknet-sdk/dist/interfaces.js";
import type { AppConfig } from "../config.ts";

type Props = {
  provider: RpcProvider;
  transfers: PrivateTransfersInterface;
  activeAddress: string;
  config: AppConfig;
};

type CommitmentInfo = {
  token: string;
  amount: bigint;
  claimed: boolean;
};

export function ClaimPanel({ provider, transfers, activeAddress, config }: Props) {
  const [secretInput, setSecretInput] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [commitmentInfo, setCommitmentInfo] = useState<CommitmentInfo | null>(null);

  // Auto-detect secret from URL on mount.
  useEffect(() => {
    const secret = parseClaimUrl(window.location.href);
    if (secret) {
      setSecretInput(secret.toString(16));
      setStatus("Secret detected from URL.");
    }
  }, []);

  async function lookupCommitment() {
    if (!secretInput) {
      setStatus("Enter a secret or paste a claim link.");
      return;
    }

    try {
      const secret = BigInt(`0x${secretInput.replace(/^0x/, "")}`);
      const commitmentHash = computeCommitmentHash(secret);

      setStatus("Looking up commitment on-chain...");
      const result = await provider.callContract({
        contractAddress: config.escrowAddress,
        entrypoint: "get_commitment",
        calldata: [commitmentHash.toString()],
      });

      // CommitmentEntry: token (felt), amount (u128), claimed (bool)
      const token = result[0];
      const amount = BigInt(result[1]);
      const claimed = BigInt(result[2]) !== 0n;

      if (amount === 0n) {
        setStatus("No commitment found for this secret.");
        setCommitmentInfo(null);
        return;
      }

      setCommitmentInfo({ token, amount, claimed });
      setStatus(
        claimed
          ? "This commitment has already been claimed."
          : `Found: ${amount.toString()} tokens. Ready to claim.`,
      );
    } catch (error) {
      setStatus(`Lookup error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function handleClaim() {
    if (!secretInput || !commitmentInfo || commitmentInfo.claimed) return;

    setLoading(true);
    try {
      const secret = BigInt(`0x${secretInput.replace(/^0x/, "")}`);

      setStatus("Building claim transaction (register + setup + claim)...");

      const result = await transfers
        .build({
          autoRegister: true,
          autoSetup: true,
          autoDiscover: { notes: "refresh", channels: "refresh" },
        })
        .with(commitmentInfo.token)
        .transfer({ recipient: activeAddress, amount: Open as never })
        .done()
        .invoke(buildClaimInvoke(config.escrowAddress, secret))
        .execute();

      if (!result.callAndProof) {
        setStatus("Failed to build claim transaction.");
        setLoading(false);
        return;
      }

      setStatus("Submitting claim transaction...");
      const executeResult = await provider.waitForTransaction(
        (
          await (transfers as never as { account: { execute: Function } }).account.execute([
            result.callAndProof.call,
          ])
        ).transaction_hash,
      );

      setStatus(`Claim successful! Transaction confirmed.`);
      setCommitmentInfo({ ...commitmentInfo, claimed: true });
    } catch (error) {
      setStatus(`Claim error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2>Claim Escrowed Tokens</h2>
      <p className="panel-description">
        Paste the claim link or secret to look up and claim escrowed tokens.
        If you're not registered in the pool, the claim will register you
        automatically.
      </p>

      <div className="field-group">
        <label>Secret (hex)</label>
        <input
          type="text"
          value={secretInput}
          onChange={(event) => {
            setSecretInput(event.target.value);
            setCommitmentInfo(null);
          }}
          placeholder="Paste claim link or secret hex"
          disabled={loading}
        />
      </div>

      <div className="button-row">
        <button className="btn" onClick={lookupCommitment} disabled={loading}>
          Lookup
        </button>
        <button
          className="btn btn-primary"
          onClick={handleClaim}
          disabled={loading || !commitmentInfo || commitmentInfo.claimed}
        >
          {loading ? "Claiming..." : "Claim Tokens"}
        </button>
      </div>

      {commitmentInfo && (
        <div className="info-box">
          <div>
            <strong>Token:</strong> {commitmentInfo.token.slice(0, 10)}...
          </div>
          <div>
            <strong>Amount:</strong> {commitmentInfo.amount.toString()}
          </div>
          <div>
            <strong>Status:</strong>{" "}
            {commitmentInfo.claimed ? "Claimed" : "Available"}
          </div>
        </div>
      )}

      {status && <div className="status-box">{status}</div>}
    </div>
  );
}
