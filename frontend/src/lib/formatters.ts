/**
 * Format a number with compact notation (k, M, B)
 * Examples: 1234 -> "1.2k", 1234567 -> "1.2M", 1234567890 -> "1.2B"
 */
export function formatCompactNumber(num: number | bigint): string {
  const n = typeof num === 'bigint' ? Number(num) : num;
  
  if (n < 1000) {
    return n.toString();
  }
  
  if (n < 1000000) {
    const k = n / 1000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
  }
  
  if (n < 1000000000) {
    const m = n / 1000000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  
  const b = n / 1000000000;
  return b % 1 === 0 ? `${b}B` : `${b.toFixed(1)}B`;
}
