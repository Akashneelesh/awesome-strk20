import { useState, useEffect, useCallback } from "react";
import type { RpcProvider } from "starknet";
import { SetupRequirement, type PrivateTransfersInterface } from "starknet-sdk";
import type { AppConfig, RecipientConfig } from "../config.ts";
import { getErc20Balance } from "../starknet.ts";
import { truncateAddress } from "../format.ts";
import { useAirdrop } from "../hooks/useAirdrop.ts";
import { RecipientList, findValidationErrors, type RecipientRow } from "./RecipientList.tsx";
import { AirdropProgress } from "./AirdropProgress.tsx";

type AdminPanelProps = {
  provider: RpcProvider;
  transfers: PrivateTransfersInterface;
  adminAddress: string;
  poolAddress: string;
  config: AppConfig;
  accounts: Array<{ address: string; privateKey: string; admin?: boolean }>;
  initialRecipients: RecipientConfig[];
};

export function AdminPanel({
  provider,
  transfers,
  adminAddress,
  poolAddress,
  config,
  accounts,
  initialRecipients,
}: AdminPanelProps) {
  const [rows, setRows] = useState<RecipientRow[]>(
    initialRecipients.map((r) => ({ address: r.address, amount: r.amount })),
  );
  const [adminBalance, setAdminBalance] = useState<bigint | null>(null);
  const [unregisteredRecipients, setUnregisteredRecipients] = useState<string[]>([]);
  const [senderNotRegistered, setSenderNotRegistered] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(false);

  const { airdropPhase, recipients, executeAirdrop, reset } = useAirdrop(
    provider,
    transfers,
    adminAddress,
    poolAddress,
    config,
    accounts,
  );

  useEffect(() => {
    getErc20Balance(provider, config.tokenAddress, adminAddress).then(setAdminBalance).catch(() => {});
  }, [provider, config.tokenAddress, adminAddress, airdropPhase]);

  const checkRecipientRegistrations = useCallback(async () => {
    const validRows = rows.filter((r) => /^0x[0-9a-fA-F]{1,64}$/.test(r.address));
    if (validRows.length === 0) {
      setUnregisteredRecipients([]);
      setSenderNotRegistered(false);
      return;
    }
    setCheckingRegistration(true);
    setSenderNotRegistered(false);
    const unregistered: string[] = [];
    for (const row of validRows) {
      try {
        const requirement = await transfers.discoverRequirement(row.address, BigInt(config.tokenAddress));
        if (requirement === SetupRequirement.Register) {
          unregistered.push(row.address);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("not registered") || message.toLowerCase().includes("viewing key")) {
          setSenderNotRegistered(true);
          break;
        }
      }
    }
    setUnregisteredRecipients(unregistered);
    setCheckingRegistration(false);
  }, [rows, transfers, config.tokenAddress]);

  useEffect(() => {
    checkRecipientRegistrations();
  }, [checkRecipientRegistrations]);

  const errors = findValidationErrors(rows, adminBalance);
  const isRunning = airdropPhase.phase !== "idle" && airdropPhase.phase !== "complete" && airdropPhase.phase !== "error";
  const canExecute = rows.length > 0 && errors.length === 0 && !isRunning && unregisteredRecipients.length === 0 && !checkingRegistration && !senderNotRegistered;

  const handleExecute = useCallback(() => {
    const entries = rows.map((row) => ({
      address: row.address,
      amount: BigInt(row.amount),
    }));
    executeAirdrop(entries);
  }, [rows, executeAirdrop]);

  return (
    <div>
      <h2 className="neon-heading">Send Airdrop</h2>

      <div className="neon-panel neon-panel-info">
        <div className="neon-row-flex" style={{ gap: "24px" }}>
          <div>
            <div className="label">Token</div>
            <div className="value">{truncateAddress(config.tokenAddress)}</div>
          </div>
          <div>
            <div className="label">Balance</div>
            <div className={`value ${adminBalance === null ? "loading" : ""}`}>
              {adminBalance !== null ? adminBalance.toString() : "loading..."}
            </div>
          </div>
        </div>
      </div>

      {airdropPhase.phase === "idle" ? (
        <>
          <RecipientList
            rows={rows}
            onChange={setRows}
            disabled={false}
            adminBalance={adminBalance}
          />

          {checkingRegistration && (
            <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>Checking registrations...</p>
          )}

          {senderNotRegistered && (
            <div className="neon-alert neon-alert-error">
              <strong>You are not registered.</strong> Switch to the Claim Airdrop view and register your viewing key in the pool before sending airdrops.
            </div>
          )}

          {unregisteredRecipients.length > 0 && (
            <div className="neon-alert neon-alert-warning">
              <strong>Unregistered recipients:</strong> These addresses must register in the pool before they can receive private tokens.
              <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
                {unregisteredRecipients.map((address) => (
                  <li key={address}><code>{truncateAddress(address)}</code></li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginTop: "16px" }}>
            <button
              className="neon-btn neon-btn-primary"
              onClick={handleExecute}
              disabled={!canExecute}
            >
              Execute Airdrop
            </button>
          </div>
        </>
      ) : (
        <>
          <RecipientList rows={rows} onChange={setRows} disabled={true} adminBalance={adminBalance} />
          <AirdropProgress phase={airdropPhase} recipients={recipients} onReset={reset} />
        </>
      )}
    </div>
  );
}
