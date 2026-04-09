type StatusBarProps = {
  txHash: string | null;
  error: string | null;
};

export function StatusBar({ txHash, error }: StatusBarProps) {
  if (!txHash && !error) return null;

  return (
    <div className={`neon-alert ${error ? "neon-alert-error" : "neon-alert-success"}`}>
      {error && <span>{error}</span>}
      {txHash && (
        <span>
          Last tx: <code>{txHash}</code>
        </span>
      )}
    </div>
  );
}
