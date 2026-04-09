import { useMemo, useState } from "react";
import { loadConfig, loadRecipients } from "./config.ts";
import { createProvider, createAccount, createTransfers } from "./starknet.ts";
import { formatChainId, truncateAddress } from "./format.ts";
import { useAccounts } from "./hooks/useAccounts.ts";
import { AdminPanel } from "./components/AdminPanel.tsx";
import { ClaimantPanel } from "./components/ClaimantPanel.tsx";

const config = loadConfig();
const initialRecipients = loadRecipients();

export function App() {
  const { accounts, activeIndex, activeAccount, adminAccount, setActiveIndex } =
    useAccounts();

  const provider = useMemo(() => createProvider(config.rpcUrl), []);

  const account = useMemo(() => {
    if (!activeAccount) return undefined;
    return createAccount(provider, activeAccount.address, activeAccount.privateKey);
  }, [provider, activeAccount]);

  const hasValidViewingKey = activeAccount ? BigInt(activeAccount.viewingKey) !== 0n : false;

  const transfers = useMemo(() => {
    if (!account || !activeAccount || !hasValidViewingKey) return undefined;
    return createTransfers(provider, account, activeAccount, config.poolAddress, config);
  }, [provider, account, activeAccount, hasValidViewingKey]);

  const [mode, setMode] = useState<"send" | "claim">("claim");

  return (
    <div className="neon-app">
      <h1 className="neon-title">Anonymous Airdrop</h1>
      <p className="neon-subtitle">
        Chain: <code>{formatChainId(config.chainId)}</code> &middot; Pool:{" "}
        <code>{truncateAddress(config.poolAddress)}</code>
      </p>

      <div className="neon-account-bar">
        <label>Account</label>
        <select
          className="neon-select"
          value={activeIndex}
          onChange={(event) => setActiveIndex(Number(event.target.value))}
        >
          {accounts.map((acc, index) => (
            <option key={acc.address} value={index}>
              {acc.name} {acc.admin ? "(Admin)" : ""} — {truncateAddress(acc.address)}
            </option>
          ))}
        </select>
        {activeAccount && (
          <button
            className="neon-btn neon-btn-sm neon-btn-copy"
            onClick={() => navigator.clipboard.writeText(activeAccount.address)}
            title="Copy full address"
          >
            Copy
          </button>
        )}
      </div>

      {activeAccount && hasValidViewingKey && (
        <div className="neon-mode-toggle">
          <button
            className={`neon-mode-btn ${mode === "send" ? "active-send" : ""}`}
            onClick={() => setMode("send")}
          >
            Send Airdrop
          </button>
          <button
            className={`neon-mode-btn ${mode === "claim" ? "active-claim" : ""}`}
            onClick={() => setMode("claim")}
          >
            Claim Airdrop
          </button>
        </div>
      )}

      {activeAccount && !hasValidViewingKey && (
        <div className="neon-alert neon-alert-error">
          This account has viewing key 0x0 — it cannot interact with the privacy pool.
        </div>
      )}

      {activeAccount && transfers && (
        <div className="neon-fade-in" key={`${activeAccount.address}-${mode}`}>
          {mode === "send" ? (
            <AdminPanel
              provider={provider}
              transfers={transfers}
              adminAddress={activeAccount.address}
              poolAddress={config.poolAddress}
              config={config}
              accounts={accounts}
              initialRecipients={initialRecipients}
            />
          ) : (
            <ClaimantPanel
              provider={provider}
              transfers={transfers}
              activeAddress={activeAccount.address}
              poolAddress={config.poolAddress}
              config={config}
              accounts={accounts}
            />
          )}
        </div>
      )}

      {!activeAccount && (
        <div className="neon-empty-state">
          No accounts loaded. Add accounts via URL parameter or localStorage.
        </div>
      )}

      <footer className="neon-footer">
        Anonymous Airdrop — Built with Starknet Privacy SDK
      </footer>
    </div>
  );
}
