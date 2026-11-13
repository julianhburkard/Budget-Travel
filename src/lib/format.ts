const whole = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Whole dollars when the amount is whole, cents otherwise. */
export function money(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? whole.format(r) : exact.format(r);
}

export function moneyRounded(n: number): string {
  return whole.format(Math.round(n));
}
