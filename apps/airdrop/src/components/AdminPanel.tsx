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
        // discoverRequirement throws if the SENDER is not registered
        if (message.toLowerCase().includes("not registered") || message.toLowerCase().includes("viewing key")) {
          setSenderNotRegistered(true);
          break;
        }
        // Other errors — skip this recipient, don't assume unregistered
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
      <h2>Admin: Airdrop</h2>
      <p>
        Token: <code>{config.tokenAddress}</code>
      </p>
      <p>
        Balance: <code>{adminBalance !== null ? adminBalance.toString() : "loading..."}</code>
      </p>

      {airdropPhase.phase === "idle" ? (
        <>
          <RecipientList
            rows={rows}
            onChange={setRows}
            disabled={false}
            adminBalance={adminBalance}
          />
          {checkingRegistration && (
            <p style={{ marginTop: "8px" }}>Checking registrations...</p>
          )}

          {senderNotRegistered && (
            <div style={{ marginTop: "8px", padding: "12px", background: "#f8d7da", border: "1px solid #f5c6cb", borderRadius: "4px" }}>
              <strong>You are not registered.</strong> Switch to the Claim Airdrop view and register your viewing key in the pool before sending airdrops.
            </div>
          )}

          {unregisteredRecipients.length > 0 && (
            <div style={{ marginTop: "8px", padding: "12px", background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "4px" }}>
              <strong>Unregistered recipients:</strong> These addresses must register in the pool before they can receive private tokens.
              <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
                {unregisteredRecipients.map((address) => (
                  <li key={address}><code>{truncateAddress(address)}</code></li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleExecute}
            disabled={!canExecute}
            style={{ marginTop: "12px", padding: "8px 24px", fontSize: "1em" }}
          >
            Execute Airdrop
          </button>
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
