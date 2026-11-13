import { describe, expect, it } from 'vitest';
import { summarize } from './budget';
import { dateRange } from './dates';
import type { Trip } from './types';

const base: Trip = {
  id: 't',
  name: 'Test',
  totalBudget: 3000,
  startDate: '2027-03-01',
  endDate: '2027-03-05', // 5 days inclusive
  foodPerDay: 60,
  foodOverrides: {},
  bufferPct: 10,
  flights: [{ id: 'f1', label: 'Outbound', date: '2027-03-01', cost: 500 }],
  rentalCars: [{ id: 'c1', label: 'Car', startDate: '2027-03-02', endDate: '2027-03-04', cost: 300 }],
  activities: [{ id: 'a1', date: '2027-03-03', name: 'Museum', cost: 40 }],
  fixedCostMode: 'spread',
  createdAt: 0,
};

describe('dateRange', () => {
  it('is inclusive and crosses month ends', () => {
    expect(dateRange('2027-02-27', '2027-03-02')).toEqual(['2027-02-27', '2027-02-28', '2027-03-01', '2027-03-02']);
  });
  it('is empty for reversed ranges', () => {
    expect(dateRange('2027-03-02', '2027-03-01')).toEqual([]);
  });
});

describe('summarize', () => {
  it('totals categories and adds the buffer on planned spending', () => {
    const s = summarize(base);
    expect(s.dayCount).toBe(5);
    expect(s.byCategory).toEqual({ flights: 500, car: 300, food: 300, activities: 40, buffer: 114 });
    expect(s.plannedTotal).toBe(1254);
    expect(s.remaining).toBe(1746);
    expect(s.avgPerDay).toBe(250.8);
    expect(s.budgetPerDay).toBe(600);
  });

  it('daily ledger totals add up to the trip total in both modes', () => {
    for (const mode of ['spread', 'actual'] as const) {
      const s = summarize({ ...base, fixedCostMode: mode });
      const sum = s.ledger.reduce((acc, d) => acc + d.total, 0);
      expect(sum).toBeCloseTo(s.plannedTotal, 6);
    }
  });

  it('spread mode divides flights and car evenly across every day', () => {
    const s = summarize(base);
    for (const d of s.ledger) {
      expect(d.lines.find((l) => l.category === 'flights')!.amount).toBe(100);
      expect(d.lines.find((l) => l.category === 'car')!.amount).toBe(60);
    }
  });

  it('actual mode places flights on their date and the car on rental days', () => {
    const s = summarize({ ...base, fixedCostMode: 'actual' });
    expect(s.ledger[0].lines.find((l) => l.category === 'flights')!.amount).toBe(500);
    expect(s.ledger[1].lines.some((l) => l.category === 'flights')).toBe(false);
    expect(s.ledger[0].lines.some((l) => l.category === 'car')).toBe(false);
    expect(s.ledger[1].lines.find((l) => l.category === 'car')!.amount).toBe(100);
  });

  it('applies per-day food overrides', () => {
    const s = summarize({ ...base, foodOverrides: { '2027-03-02': 150 } });
    expect(s.byCategory.food).toBe(390);
  });

  it('keeps activities outside the trip dates counted but flagged', () => {
    const s = summarize({ ...base, activities: [...base.activities, { id: 'a2', date: '2027-04-01', name: 'Late', cost: 10 }] });
    expect(s.strayActivities.map((a) => a.id)).toEqual(['a2']);
    expect(s.byCategory.activities).toBe(50);
  });
});
