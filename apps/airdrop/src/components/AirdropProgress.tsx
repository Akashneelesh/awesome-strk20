import type { AirdropPhase, RecipientEntry } from "../hooks/useAirdrop.ts";
import { truncateAddress } from "../format.ts";

type AirdropProgressProps = {
  phase: AirdropPhase;
  recipients: RecipientEntry[];
  onReset: () => void;
};

function phaseLabel(phase: AirdropPhase): string {
  switch (phase.phase) {
    case "idle":
      return "Ready";
    case "approving":
      return "Approving token spend...";
    case "depositing":
      return "Depositing into privacy pool...";
    case "waiting_maturity":
      return `Waiting for note maturity (${phase.blocksRemaining} blocks remaining)...`;
    case "transferring":
      if (phase.mode === "batch") return "Proving batch transfer...";
      return `Transferring individually (${phase.progress} done)...`;
    case "complete":
      return `Complete: ${phase.succeeded} succeeded, ${phase.failed} failed`;
    case "error":
      return `Error: ${phase.message}`;
  }
}

function phaseClass(phase: AirdropPhase): string {
  if (phase.phase === "complete") return "phase-complete";
  if (phase.phase === "error") return "phase-error";
  return "";
}

function badgeClass(status: RecipientEntry["status"]): string {
  return `neon-badge neon-badge-${status}`;
}

function statusLabel(status: RecipientEntry["status"]): string {
  switch (status) {
    case "pending": return "...";
    case "proving": return "Proving";
    case "submitted": return "Submitted";
    case "confirmed": return "Confirmed";
    case "done": return "Done";
    case "failed": return "Failed";
  }
}

export function AirdropProgress({ phase, recipients, onReset }: AirdropProgressProps) {
  const isRunning =
    phase.phase !== "idle" && phase.phase !== "complete" && phase.phase !== "error";

  return (
    <div style={{ marginTop: "16px" }}>
      <h3 className="neon-subheading">Airdrop Progress</h3>
      <p className={`neon-phase-label ${phaseClass(phase)}`}>
        {phaseLabel(phase)}
      </p>

      {recipients.length > 0 && (
        <table className="neon-table" style={{ marginTop: "12px" }}>
          <thead>
            <tr>
              <th>Recipient</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th style={{ textAlign: "center" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((recipient) => (
              <tr key={recipient.address}>
                <td>
                  <code>{truncateAddress(recipient.address)}</code>
                </td>
                <td className="amount">{recipient.amount.toString()}</td>
                <td className="status-center">
                  <span className={badgeClass(recipient.status)}>
                    {statusLabel(recipient.status)}
                  </span>
                  {recipient.error && (
                    <div style={{ fontSize: "0.75rem", color: "var(--red)", marginTop: "4px" }}>
                      {recipient.error}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!isRunning && phase.phase !== "idle" && (
        <button className="neon-btn" onClick={onReset} style={{ marginTop: "12px" }}>
          Reset
        </button>
      )}
    </div>
  );
}
