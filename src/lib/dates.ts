import type { ISODate } from './types';

const DAY_MS = 86_400_000;

function toUTC(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isValidDate(date: string | undefined): date is ISODate {
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(toUTC(date));
}

/** Every date from start to end, inclusive. Empty if the range is invalid. */
export function dateRange(start: ISODate, end: ISODate): ISODate[] {
  if (!isValidDate(start) || !isValidDate(end)) return [];
  const a = toUTC(start);
  const b = toUTC(end);
  if (b < a) return [];
  const out: ISODate[] = [];
  for (let t = a; t <= b; t += DAY_MS) out.push(fromUTC(t));
  return out;
}

export function addDays(date: ISODate, n: number): ISODate {
  return fromUTC(toUTC(date) + n * DAY_MS);
}

export function todayISO(): ISODate {
  const now = new Date();
  return fromUTC(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function formatDay(date: ISODate): string {
  return new Date(toUTC(date)).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatShort(date: ISODate): string {
  return new Date(toUTC(date)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
