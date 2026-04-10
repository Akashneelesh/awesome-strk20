import { useEffect, useState } from "react";
import { Account, type RpcProvider } from "starknet";
import {
  Open,
  computeCommitmentHash,
  buildClaimInvoke,
  parseEscrowSecret,
  type PrivateTransfersInterface,
} from "starknet-sdk";
import { submitPrivateTransaction } from "../starknet.ts";
import type { AppConfig } from "../config.ts";

type Props = {
  account: Account;
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

function parseSecretInput(input: string): bigint | null {
  return parseEscrowSecret(input);
}

export function ClaimPanel({ account, provider, transfers, activeAddress, config }: Props) {
  const [secretInput, setSecretInput] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [commitmentInfo, setCommitmentInfo] = useState<CommitmentInfo | null>(null);

  // Auto-detect secret from URL on mount.
  useEffect(() => {
    const secret = parseSecretInput(window.location.href);
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
      const secret = parseSecretInput(secretInput);
      if (secret === null) {
        setStatus("Enter a valid secret hex string or full claim link.");
        return;
      }
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
      const secret = parseSecretInput(secretInput);
      if (secret === null) {
        setStatus("Enter a valid secret hex string or full claim link.");
        return;
      }

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
        .execute({ provingBlockId: (await provider.getBlockNumber()) - 10 });

      if (!result.callAndProof) {
        setStatus("Failed to build claim transaction.");
        return;
      }

      setStatus("Submitting claim transaction...");
      const claimTxHash = await submitPrivateTransaction(account, provider, result.callAndProof);
      setTxHash(claimTxHash);

      setStatus("Claim successful. The escrowed amount is now available in your private pool balance.");
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

      {txHash && (
        <div className="result-box">
          <label>Transaction Hash</label>
          <div className="link-row">
            <input type="text" value={txHash} readOnly />
            <button
              className="btn btn-sm"
              onClick={() => navigator.clipboard.writeText(txHash)}
            >
              Copy
            </button>
            <a
              className="btn btn-sm"
              href={`https://sepolia.voyager.online/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View
            </a>
          </div>
        </div>
      )}

      {status && <div className="status-box">{status}</div>}
    </div>
  );
}
