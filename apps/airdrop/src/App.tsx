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
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px", fontFamily: "monospace" }}>
      <h1>Anonymous Airdrop</h1>
      <p>
        Chain: <code>{formatChainId(config.chainId)}</code> | Pool:{" "}
        <code>{truncateAddress(config.poolAddress)}</code>
      </p>

      <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
        <label>Account: </label>
        <select
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
            onClick={() => navigator.clipboard.writeText(activeAccount.address)}
            title="Copy full address"
            style={{ cursor: "pointer", fontSize: "0.8em", padding: "2px 6px" }}
          >
            Copy Address
          </button>
        )}
      </div>

      {activeAccount && hasValidViewingKey && (
        <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
          <button
            onClick={() => setMode("send")}
            style={{
              padding: "6px 16px",
              fontWeight: mode === "send" ? "bold" : "normal",
              background: mode === "send" ? "#333" : "#eee",
              color: mode === "send" ? "#fff" : "#333",
              border: "1px solid #333",
              cursor: "pointer",
            }}
          >
            Send Airdrop
          </button>
          <button
            onClick={() => setMode("claim")}
            style={{
              padding: "6px 16px",
              fontWeight: mode === "claim" ? "bold" : "normal",
              background: mode === "claim" ? "#333" : "#eee",
              color: mode === "claim" ? "#fff" : "#333",
              border: "1px solid #333",
              cursor: "pointer",
            }}
          >
            Claim Airdrop
          </button>
        </div>
      )}

      {activeAccount && !hasValidViewingKey && (
        <p style={{ color: "#c00" }}>
          This account has viewing key 0x0 — it cannot interact with the privacy pool.
        </p>
      )}

      {activeAccount && transfers && (
        mode === "send" ? (
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
        )
      )}

      {!activeAccount && (
        <p>No accounts loaded. Add accounts via URL parameter or localStorage.</p>
      )}

      <footer style={{ marginTop: "40px", fontSize: "0.8em", color: "#888" }}>
        Anonymous Airdrop — Built with Starknet Privacy SDK
      </footer>
    </div>
  );
}
