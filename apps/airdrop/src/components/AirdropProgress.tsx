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

function statusBadge(status: RecipientEntry["status"]): string {
  switch (status) {
    case "pending":
      return "...";
    case "proving":
      return "Proving";
    case "submitted":
      return "Submitted";
    case "confirmed":
      return "Confirmed";
    case "done":
      return "Done";
    case "failed":
      return "Failed";
  }
}

export function AirdropProgress({ phase, recipients, onReset }: AirdropProgressProps) {
  const isRunning =
    phase.phase !== "idle" && phase.phase !== "complete" && phase.phase !== "error";

  return (
    <div>
      <h3>Airdrop Progress</h3>
      <p>
        <strong>{phaseLabel(phase)}</strong>
      </p>

      {recipients.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Recipient</th>
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
                <td style={{ textAlign: "right" }}>{recipient.amount.toString()}</td>
                <td
                  style={{
                    textAlign: "center",
                    color: recipient.status === "failed" ? "red" : recipient.status === "done" ? "green" : "inherit",
                  }}
                >
                  {statusBadge(recipient.status)}
                  {recipient.error && <div style={{ fontSize: "0.8em" }}>{recipient.error}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!isRunning && phase.phase !== "idle" && (
        <button onClick={onReset} style={{ marginTop: "8px" }}>
          Reset
        </button>
      )}
    </div>
  );
}
