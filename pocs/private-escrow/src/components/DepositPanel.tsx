import { useEffect, useState } from "react";
import { Account, type RpcProvider } from "starknet";
import {
  buildClaimUrl,
  generateEscrowSecret,
  computeCommitmentHash,
  buildDepositInvoke,
  type PrivateTransfersInterface,
} from "starknet-sdk";
import { getErc20Balance, submitPrivateTransaction } from "../starknet.ts";
import type { AppConfig } from "../config.ts";

type Props = {
  account: Account;
  provider: RpcProvider;
  transfers: PrivateTransfersInterface;
  activeAddress: string;
  config: AppConfig;
};

export function DepositPanel({ account, provider, transfers, activeAddress, config }: Props) {
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [claimLink, setClaimLink] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [publicBalance, setPublicBalance] = useState<bigint | null>(null);
  const [privateBalance, setPrivateBalance] = useState<bigint | null>(null);
  const [noteCount, setNoteCount] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  async function refreshBalances() {
    setBalanceLoading(true);
    try {
      // Public ERC20 balance
      const pub = await getErc20Balance(provider, config.tokenAddress, activeAddress);
      setPublicBalance(pub);

      // Private pool balance (sum of unspent notes)
      const discovered = await transfers.discoverNotes({
        tokens: [BigInt(config.tokenAddress)],
      });
      const notes = discovered.notes.get(BigInt(config.tokenAddress)) ?? [];
      const total = notes.reduce((sum, note) => sum + note.amount, 0n);
      setPrivateBalance(total);
      setNoteCount(notes.length);
    } catch (error) {
      setStatus(`Balance error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBalanceLoading(false);
    }
  }

  // Auto-refresh balances on mount and when account changes
  useEffect(() => {
    refreshBalances();
  }, [activeAddress]);

  async function handleDeposit() {
    if (!amount || BigInt(amount) === 0n) {
      setStatus("Enter a valid amount");
      return;
    }

    setLoading(true);
    setStatus("Generating secret...");
    try {
      const secret = generateEscrowSecret();
      const commitmentHash = computeCommitmentHash(secret);
      const depositAmount = BigInt(amount);

      setStatus("Building privacy pool transaction (use notes → withdraw to escrow → invoke)...");

      const result = await transfers
        .build({
          autoSetup: true,
          autoDiscover: { notes: "refresh", channels: "refresh" },
          autoSelectNotes: "naive",
        })
        .surplusTo(activeAddress)
        .with(config.tokenAddress, (t) =>
          t.withdraw({ recipient: config.escrowAddress, amount: depositAmount }),
        )
        .invoke(
          buildDepositInvoke(
            config.escrowAddress,
            commitmentHash,
            config.tokenAddress,
            depositAmount,
          ),
        )
        .execute({ provingBlockId: (await provider.getBlockNumber()) - 10 });

      if (!result.callAndProof) {
        setStatus("Failed to build deposit transaction - no callAndProof returned.");
        return;
      }

      setStatus("Submitting deposit transaction...");
      const depositTxHash = await submitPrivateTransaction(account, provider, result.callAndProof);
      setTxHash(depositTxHash);

      const link = buildClaimUrl(
        `${window.location.origin}${window.location.pathname}`,
        secret,
      );
      setClaimLink(link);
      setStatus("Deposit confirmed. Share the claim link so the recipient can claim into a private pool note.");

      // Refresh balances after deposit
      await refreshBalances();
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2>Create Escrow Deposit</h2>
      <p className="panel-description">
        Deposit tokens from your private balance into escrow. The deposit goes
        through the privacy pool so your identity stays hidden. Share the
        generated link with the recipient - they can claim even if they haven't
        registered in the pool yet.
      </p>

      <div className="field-group">
        <label>Balances</label>
        <div className="balance-row">
          <button
            className="btn btn-sm"
            onClick={refreshBalances}
            disabled={balanceLoading}
          >
            {balanceLoading ? "Loading..." : "Refresh Balances"}
          </button>
        </div>
        <table className="balance-table">
          <tbody>
            <tr>
              <td>Public (ERC20)</td>
              <td>{publicBalance !== null ? publicBalance.toString() : "-"}</td>
            </tr>
            <tr>
              <td>Private (Pool)</td>
              <td>
                {privateBalance !== null
                  ? `${privateBalance.toString()} (${noteCount} note${noteCount !== 1 ? "s" : ""})`
                  : "-"}
              </td>
            </tr>
          </tbody>
        </table>
        {privateBalance !== null && privateBalance === 0n && (
          <p className="hint">
            No private balance. Deposit tokens into the pool first before escrowing.
          </p>
        )}
      </div>

      <div className="field-group">
        <label>Amount to Escrow (from private balance)</label>
        <input
          type="text"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="e.g. 1000"
          disabled={loading}
        />
      </div>

      <button className="btn btn-primary" onClick={handleDeposit} disabled={loading}>
        {loading ? "Processing..." : "Deposit & Generate Link"}
      </button>

      {claimLink && (
        <div className="result-box">
          <label>Claim Link (share with recipient)</label>
          <div className="link-row">
            <input type="text" value={claimLink} readOnly />
            <button
              className="btn btn-sm"
              onClick={() => navigator.clipboard.writeText(claimLink)}
            >
              Copy
            </button>
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
