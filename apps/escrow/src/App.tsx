import { useMemo, useState } from "react";
import { loadConfig, loadAccounts } from "./config.ts";
import { createProvider, createAccount, createTransfers } from "./starknet.ts";
import { DepositPanel } from "./components/DepositPanel.tsx";
import { ClaimPanel } from "./components/ClaimPanel.tsx";

const config = loadConfig();
const accounts = loadAccounts();

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function App() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState<"deposit" | "claim">("claim");

  const activeAccount = accounts[activeIndex];

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

  return (
    <div className="app">
      <h1>Privacy Escrow</h1>
      <p className="subtitle">
        Pool: <code>{truncateAddress(config.poolAddress)}</code> &middot; Escrow:{" "}
        <code>{truncateAddress(config.escrowAddress)}</code>
      </p>

      <div className="account-bar">
        <label>Account</label>
        <select
          value={activeIndex}
          onChange={(event) => setActiveIndex(Number(event.target.value))}
        >
          {accounts.map((acc, index) => (
            <option key={acc.address} value={index}>
              {acc.name} — {truncateAddress(acc.address)}
            </option>
          ))}
        </select>
      </div>

      <div className="mode-toggle">
        <button
          className={`mode-btn ${mode === "deposit" ? "active" : ""}`}
          onClick={() => setMode("deposit")}
        >
          Deposit (Sender)
        </button>
        <button
          className={`mode-btn ${mode === "claim" ? "active" : ""}`}
          onClick={() => setMode("claim")}
        >
          Claim (Recipient)
        </button>
      </div>

      {!activeAccount && (
        <div className="empty-state">
          No accounts loaded. Set VITE_ACCOUNTS in .env.
        </div>
      )}

      {activeAccount && account && transfers && mode === "deposit" && (
        <DepositPanel
          provider={provider}
          transfers={transfers}
          activeAddress={activeAccount.address}
          config={config}
        />
      )}

      {activeAccount && account && mode === "deposit" && !transfers && (
        <div className="alert">
          This account needs a valid viewing key to deposit through the privacy pool.
        </div>
      )}

      {activeAccount && mode === "claim" && !hasValidViewingKey && (
        <div className="alert">
          This account has viewing key 0x0 — claiming will auto-register it, but
          you need a valid viewing key configured.
        </div>
      )}

      {activeAccount && transfers && mode === "claim" && (
        <ClaimPanel
          provider={provider}
          transfers={transfers}
          activeAddress={activeAccount.address}
          config={config}
        />
      )}

      <footer className="footer">
        Privacy Escrow — Deferred delivery for unregistered recipients
      </footer>
    </div>
  );
}
