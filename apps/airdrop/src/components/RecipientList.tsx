import { useState, useCallback } from "react";
import { truncateAddress } from "../format.ts";

export type RecipientRow = {
  address: string;
  amount: string;
};

type RecipientListProps = {
  rows: RecipientRow[];
  onChange: (rows: RecipientRow[]) => void;
  disabled: boolean;
  adminBalance: bigint | null;
};

function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{1,64}$/.test(address);
}

function isValidAmount(amount: string): boolean {
  try {
    return BigInt(amount) > 0n;
  } catch {
    return false;
  }
}

function findValidationErrors(
  rows: RecipientRow[],
  adminBalance: bigint | null,
): string[] {
  const errors: string[] = [];
  const addresses = new Set<string>();

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!isValidAddress(row.address)) {
      errors.push(`Row ${rowIndex + 1}: invalid address`);
    }
    if (!isValidAmount(row.amount)) {
      errors.push(`Row ${rowIndex + 1}: amount must be a positive integer`);
    }
    const normalizedAddress = row.address.toLowerCase();
    if (addresses.has(normalizedAddress)) {
      errors.push(`Row ${rowIndex + 1}: duplicate address`);
    }
    addresses.add(normalizedAddress);
  }

  if (adminBalance !== null && rows.length > 0) {
    const total = rows.reduce((sum, row) => {
      try {
        return sum + BigInt(row.amount);
      } catch {
        return sum;
      }
    }, 0n);
    if (total > adminBalance) {
      errors.push(`Total (${total}) exceeds balance (${adminBalance})`);
    }
  }

  return errors;
}

export function RecipientList({ rows, onChange, disabled, adminBalance }: RecipientListProps) {
  const [csvInput, setCsvInput] = useState("");
  const errors = findValidationErrors(rows, adminBalance);

  const updateRow = useCallback(
    (index: number, field: keyof RecipientRow, value: string) => {
      const updated = [...rows];
      updated[index] = { ...updated[index], [field]: value };
      onChange(updated);
    },
    [rows, onChange],
  );

  const addRow = useCallback(() => {
    onChange([...rows, { address: "", amount: "" }]);
  }, [rows, onChange]);

  const removeRow = useCallback(
    (index: number) => {
      onChange(rows.filter((_, rowIndex) => rowIndex !== index));
    },
    [rows, onChange],
  );

  const handleCsvPaste = useCallback(() => {
    const lines = csvInput
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const parsed: RecipientRow[] = lines
      .map((line) => {
        const [address, amount] = line.split(",").map((part) => part.trim());
        return address && amount ? { address, amount } : null;
      })
      .filter((row): row is RecipientRow => row !== null);

    if (parsed.length > 0) {
      onChange([...rows, ...parsed]);
      setCsvInput("");
    }
  }, [csvInput, rows, onChange]);

  const totalAmount = rows.reduce((sum, row) => {
    try {
      return sum + BigInt(row.amount);
    } catch {
      return sum;
    }
  }, 0n);

  return (
    <div>
      <h3>Recipients</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Address</th>
            <th style={{ textAlign: "right" }}>Amount</th>
            <th style={{ width: "40px" }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>
                {disabled ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <code>{truncateAddress(row.address)}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(row.address)}
                      title="Copy full address"
                      style={{ cursor: "pointer", fontSize: "0.8em", padding: "2px 4px" }}
                    >
                      Copy
                    </button>
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", width: "100%" }}>
                    <input
                      type="text"
                      value={row.address}
                      onChange={(event) => updateRow(index, "address", event.target.value)}
                      placeholder="0x..."
                      style={{ flex: 1, fontFamily: "monospace" }}
                    />
                    {row.address && (
                      <button
                        onClick={() => navigator.clipboard.writeText(row.address)}
                        title="Copy full address"
                        style={{ cursor: "pointer", fontSize: "0.8em", padding: "2px 4px" }}
                      >
                        Copy
                      </button>
                    )}
                  </span>
                )}
              </td>
              <td>
                {disabled ? (
                  <code>{row.amount}</code>
                ) : (
                  <input
                    type="text"
                    value={row.amount}
                    onChange={(event) => updateRow(index, "amount", event.target.value)}
                    placeholder="0"
                    style={{ width: "100%", textAlign: "right" }}
                  />
                )}
              </td>
              <td>
                {!disabled && (
                  <button onClick={() => removeRow(index)} title="Remove">
                    x
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ textAlign: "left" }}>
              <strong>Total: {rows.length} recipients</strong>
            </td>
            <td style={{ textAlign: "right" }}>
              <strong>{totalAmount.toString()}</strong>
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      {!disabled && (
        <div style={{ marginTop: "8px" }}>
          <button onClick={addRow}>+ Add Row</button>
          <details style={{ marginTop: "8px" }}>
            <summary>Paste CSV</summary>
            <textarea
              value={csvInput}
              onChange={(event) => setCsvInput(event.target.value)}
              placeholder={"0x1234...,500\n0x5678...,300"}
              rows={4}
              style={{ width: "100%", fontFamily: "monospace" }}
            />
            <button onClick={handleCsvPaste}>Import CSV</button>
          </details>
        </div>
      )}

      {errors.length > 0 && (
        <div style={{ color: "red", marginTop: "8px" }}>
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export { findValidationErrors };
