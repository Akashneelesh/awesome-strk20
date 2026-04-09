import { useState, useEffect } from "react";
import type { RpcProvider } from "starknet";
import type { PrivateTransfersInterface } from "starknet-sdk";
import type { AppConfig } from "../config.ts";
import { useClaimant } from "../hooks/useClaimant.ts";
import { StatusBar } from "./StatusBar.tsx";

type ClaimantPanelProps = {
  provider: RpcProvider;
  transfers: PrivateTransfersInterface;
  activeAddress: string;
  poolAddress: string;
  config: AppConfig;
  accounts: Array<{ address: string; privateKey: string }>;
};

export function ClaimantPanel({
  provider,
  transfers,
  activeAddress,
  poolAddress,
  config,
  accounts,
}: ClaimantPanelProps) {
  const { state, discover, withdraw, register, checkRegistration } = useClaimant(
    provider,
    transfers,
    activeAddress,
    poolAddress,
    config,
    accounts,
  );

  const [withdrawAmount, setWithdrawAmount] = useState("");

  useEffect(() => {
    checkRegistration();
  }, [checkRegistration]);

  useEffect(() => {
    if (state.registered) {
      discover();
    }
  }, [state.registered, discover]);

  useEffect(() => {
    if (state.totalBalance > 0n) {
      setWithdrawAmount(state.totalBalance.toString());
    }
  }, [state.totalBalance]);

  const canWithdraw =
    !state.withdrawing &&
    !state.discovering &&
    state.totalBalance > 0n &&
    withdrawAmount.length > 0;

  return (
    <div>
      <h2>Claim Airdrop</h2>

      <StatusBar txHash={state.lastTxHash} error={state.lastError} />

      {state.registered === false && (
        <div style={{ padding: "12px", marginBottom: "12px", background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "4px" }}>
          <p style={{ margin: "0 0 8px 0" }}>
            <strong>Not registered.</strong> You must register your viewing key in the privacy pool before you can receive or claim private tokens.
          </p>
          <button
            onClick={register}
            disabled={state.registering}
            style={{ padding: "6px 16px" }}
          >
            {state.registering ? "Registering..." : "Register in Pool"}
          </button>
        </div>
      )}

      {state.registered === null && (
        <p>Checking registration status...</p>
      )}

      {state.registered && (
        <div style={{ marginBottom: "12px" }}>
          <strong>Private Balance: </strong>
          <code>{state.discovering ? "discovering..." : state.totalBalance.toString()}</code>
          <button onClick={discover} disabled={state.discovering} style={{ marginLeft: "8px" }}>
            Refresh
          </button>
        </div>
      )}

      {state.registered && state.notes.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <h3>Notes ({state.notes.length})</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>#</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {state.notes.map((note, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td style={{ textAlign: "right" }}>
                    <code>{note.amount?.toString() ?? "?"}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {state.registered && (
        <div>
          <h3>Withdraw</h3>
          <input
            type="text"
            value={withdrawAmount}
            onChange={(event) => setWithdrawAmount(event.target.value)}
            placeholder="Amount"
            style={{ width: "200px", marginRight: "8px" }}
          />
          <button
            onClick={() => withdraw(BigInt(withdrawAmount))}
            disabled={!canWithdraw}
          >
            {state.withdrawing ? "Withdrawing..." : "Withdraw"}
          </button>
        </div>
      )}
    </div>
  );
}
