import { dateRange } from './dates';
import type { Activity, ISODate, Trip } from './types';

export type Category = 'flights' | 'car' | 'food' | 'activities' | 'buffer';

export const CATEGORY_LABELS: Record<Category, string> = {
  flights: 'Flights',
  car: 'Rental car',
  food: 'Food & drinks',
  activities: 'Activities',
  buffer: 'Unplanned',
};

export interface LedgerLine {
  key: string;
  category: Category;
  label: string;
  amount: number;
  /** Auto-generated lines come from the summary settings, not the ledger. */
  auto: boolean;
  activity?: Activity;
}

export interface LedgerDay {
  date: ISODate;
  index: number;
  lines: LedgerLine[];
  /** Planned spend for the day, before the unplanned buffer. */
  subtotal: number;
  buffer: number;
  total: number;
}

export interface TripSummary {
  days: ISODate[];
  dayCount: number;
  byCategory: Record<Category, number>;
  /** Planned spending before the buffer. */
  plannedSubtotal: number;
  /** Planned spending including the buffer: the full expected trip cost. */
  plannedTotal: number;
  remaining: number;
  avgPerDay: number;
  budgetPerDay: number;
  ledger: LedgerDay[];
  /** Activities whose date falls outside the trip dates (still counted). */
  strayActivities: Activity[];
}

/** Round to cents so floating point noise never shows up in totals. */
const cents = (n: number) => Math.round(n * 100) / 100;

function clampToTrip(date: ISODate, days: ISODate[]): ISODate {
  if (date < days[0]) return days[0];
  if (date > days[days.length - 1]) return days[days.length - 1];
  return date;
}

export function foodForDay(trip: Trip, date: ISODate): number {
  return trip.foodOverrides[date] ?? trip.foodPerDay;
}

export function summarize(trip: Trip): TripSummary {
  const days = dateRange(trip.startDate, trip.endDate);
  const n = days.length;
  const daySet = new Set(days);

  const linesByDay = new Map<ISODate, LedgerLine[]>(days.map((d) => [d, []]));
  const push = (date: ISODate, line: LedgerLine) => linesByDay.get(date)?.push(line);

  if (n > 0) {
    const spread = trip.fixedCostMode === 'spread';

    for (const f of trip.flights) {
      if (spread) {
        days.forEach((d) =>
          push(d, { key: `f-${f.id}`, category: 'flights', label: `${f.label} (1/${n} share)`, amount: f.cost / n, auto: true }),
        );
      } else {
        push(clampToTrip(f.date, days), { key: `f-${f.id}`, category: 'flights', label: f.label, amount: f.cost, auto: true });
      }
    }

    for (const c of trip.rentalCars) {
      const rentalDays = dateRange(c.startDate, c.endDate).filter((d) => daySet.has(d));
      // Spread mode, or a rental that doesn't overlap the trip: spread over the whole trip.
      const target = spread || rentalDays.length === 0 ? days : rentalDays;
      target.forEach((d, i) =>
        push(d, {
          key: `c-${c.id}`,
          category: 'car',
          label: spread ? `${c.label} (1/${n} share)` : `${c.label} (day ${i + 1} of ${target.length})`,
          amount: c.cost / target.length,
          auto: true,
        }),
      );
    }

    for (const d of days) {
      push(d, { key: 'food', category: 'food', label: 'Food & drinks', amount: foodForDay(trip, d), auto: true });
    }
  }

  const strayActivities: Activity[] = [];
  for (const a of trip.activities) {
    if (daySet.has(a.date)) {
      push(a.date, { key: `a-${a.id}`, category: 'activities', label: a.name, amount: a.cost, auto: false, activity: a });
    } else {
      strayActivities.push(a);
    }
  }

  const byCategory: Record<Category, number> = { flights: 0, car: 0, food: 0, activities: 0, buffer: 0 };
  const pct = Math.max(0, trip.bufferPct) / 100;

  const ledger: LedgerDay[] = days.map((date, index) => {
    const lines = linesByDay.get(date)!;
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const buffer = subtotal * pct;
    return { date, index, lines, subtotal, buffer, total: subtotal + buffer };
  });

  // Category totals come from the source data so they're exact, regardless of spreading.
  byCategory.flights = n ? trip.flights.reduce((s, f) => s + f.cost, 0) : 0;
  byCategory.car = n ? trip.rentalCars.reduce((s, c) => s + c.cost, 0) : 0;
  byCategory.food = days.reduce((s, d) => s + foodForDay(trip, d), 0);
  byCategory.activities = trip.activities.reduce((s, a) => s + a.cost, 0);
  const plannedSubtotal = byCategory.flights + byCategory.car + byCategory.food + byCategory.activities;
  byCategory.buffer = plannedSubtotal * pct;
  const plannedTotal = plannedSubtotal + byCategory.buffer;

  for (const k of Object.keys(byCategory) as Category[]) byCategory[k] = cents(byCategory[k]);

  return {
    days,
    dayCount: n,
    byCategory,
    plannedSubtotal: cents(plannedSubtotal),
    plannedTotal: cents(plannedTotal),
    remaining: cents(trip.totalBudget - plannedTotal),
    avgPerDay: n ? cents(plannedTotal / n) : 0,
    budgetPerDay: n ? cents(trip.totalBudget / n) : 0,
    ledger,
    strayActivities,
  };
}
