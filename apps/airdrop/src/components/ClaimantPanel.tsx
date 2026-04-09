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
      <h2 className="neon-heading">Claim Airdrop</h2>

      <StatusBar txHash={state.lastTxHash} error={state.lastError} />

      {state.registered === false && (
        <div className="neon-alert neon-alert-warning">
          <p style={{ margin: "0 0 10px 0" }}>
            <strong>Not registered.</strong> You must register your viewing key in the privacy pool before you can receive or claim private tokens.
          </p>
          <button
            className="neon-btn neon-btn-lime"
            onClick={register}
            disabled={state.registering}
          >
            {state.registering ? "Registering..." : "Register in Pool"}
          </button>
        </div>
      )}

      {state.registered === null && (
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>Checking registration status...</p>
      )}

      {state.registered && (
        <div className="neon-balance">
          <span className="label">Private Balance</span>
          <span className={`value ${state.discovering ? "loading" : ""}`}>
            {state.discovering ? "discovering..." : state.totalBalance.toString()}
          </span>
          <button className="neon-btn neon-btn-sm" onClick={discover} disabled={state.discovering}>
            Refresh
          </button>
        </div>
      )}

      {state.registered && state.notes.length > 0 && (
        <div className="neon-panel" style={{ marginBottom: "16px" }}>
          <h3 className="neon-subheading" style={{ marginTop: 0 }}>Notes ({state.notes.length})</h3>
          <table className="neon-table">
            <thead>
              <tr>
                <th>#</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {state.notes.map((note, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td className="amount">
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
          <h3 className="neon-subheading">Withdraw</h3>
          <div className="neon-row-flex">
            <input
              className="neon-input"
              type="text"
              value={withdrawAmount}
              onChange={(event) => setWithdrawAmount(event.target.value)}
              placeholder="Amount"
              style={{ maxWidth: "240px" }}
            />
            <button
              className="neon-btn neon-btn-lime"
              onClick={() => withdraw(BigInt(withdrawAmount))}
              disabled={!canWithdraw}
            >
              {state.withdrawing ? "Withdrawing..." : "Withdraw"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
