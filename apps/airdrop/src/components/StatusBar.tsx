type StatusBarProps = {
  txHash: string | null;
  error: string | null;
};

export function StatusBar({ txHash, error }: StatusBarProps) {
  if (!txHash && !error) return null;

  return (
    <div
      style={{
        padding: "8px 12px",
        marginBottom: "12px",
        borderRadius: "4px",
        background: error ? "#fee" : "#efe",
        border: `1px solid ${error ? "#c00" : "#0a0"}`,
        fontFamily: "monospace",
        fontSize: "0.85em",
      }}
    >
      {error && <span style={{ color: "#c00" }}>{error}</span>}
      {txHash && (
        <span>
          Last tx: <code>{txHash}</code>
        </span>
      )}
    </div>
  );
}
