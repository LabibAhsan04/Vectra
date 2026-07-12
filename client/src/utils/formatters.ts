export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function formatChangePct(changePct: number): string {
  const sign = changePct >= 0 ? '+' : '';
  return `${sign}${changePct.toFixed(2)}%`;
}

export function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}
