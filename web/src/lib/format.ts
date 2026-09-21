const SATS_PER_BTC = 100_000_000;

/** "0.00123456 BTC" — always 8 decimals so columns line up. */
export function formatBtc(sats: number): string {
  const sign = sats < 0 ? "-" : "";
  const abs = Math.abs(sats);
  const whole = Math.floor(abs / SATS_PER_BTC);
  const frac = (abs % SATS_PER_BTC).toString().padStart(8, "0");
  return `${sign}${whole}.${frac} BTC`;
}

export function formatSats(sats: number): string {
  return `${sats.toLocaleString()} sat`;
}

export function shortId(id: string, n = 8): string {
  return `${id.slice(0, n)}…${id.slice(-n)}`;
}

/** "3 days ago", "2 hours ago", or "unconfirmed" when no timestamp. */
export function timeAgo(unixSeconds: number | null): string {
  if (unixSeconds == null) return "unconfirmed";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - unixSeconds));
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, "year"],
    [60 * 60 * 24 * 30, "month"],
    [60 * 60 * 24, "day"],
    [60 * 60, "hour"],
    [60, "minute"],
  ];
  for (const [size, name] of units) {
    if (s >= size) {
      const n = Math.floor(s / size);
      return `${n} ${name}${n === 1 ? "" : "s"} ago`;
    }
  }
  return "just now";
}

export function confirmations(height: number | null, tip: number | null): number | null {
  if (height == null || tip == null) return height == null ? 0 : null;
  return Math.max(0, tip - height + 1);
}
