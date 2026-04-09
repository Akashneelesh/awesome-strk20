export function formatChainId(hex: string): string {
  const raw = hex.startsWith("0x") ? hex.slice(2) : hex;
  let name = "";
  for (let offset = 0; offset < raw.length; offset += 2) {
    name += String.fromCharCode(parseInt(raw.slice(offset, offset + 2), 16));
  }
  return name;
}

export function truncateAddress(hex: string): string {
  const padded = hex.startsWith("0x") ? hex : `0x${hex}`;
  if (padded.length <= 14) return padded;
  return `${padded.slice(0, 10)}...${padded.slice(-4)}`;
}
