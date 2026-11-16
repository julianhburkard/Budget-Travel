import { describe, expect, it } from 'vitest';
import { dateRange } from './dates';
import { estimate, rateOn, searchLocations, type PerDiemLocation } from './perDiem';

const azores: PerDiemLocation = {
  id: 'f-portugal-ponta-delgada',
  name: 'Ponta Delgada',
  region: 'Portugal',
  kind: 'foreign',
  seasons: [
    { start: '04-01', end: '10-31', lodging: 178, mie: 61 },
    { start: '11-01', end: '03-31', lodging: 139, mie: 57 },
  ],
};
const boston: PerDiemLocation = {
  id: 'us-ma-boston-cambridge',
  name: 'Boston / Cambridge',
  region: 'Massachusetts',
  kind: 'us',
  area: 'Suffolk, city of Cambridge',
  seasons: [
    { start: '01-01', end: '02-28', lodging: 213, mie: 92 },
    { start: '03-01', end: '12-31', lodging: 305, mie: 92 },
  ],
};
const lisbon: PerDiemLocation = { id: 'f-pt-lisbon', name: 'Lisbon', region: 'Portugal', kind: 'foreign', seasons: [{ start: '01-01', end: '12-31', lodging: 267, mie: 107 }] };
const otherPt: PerDiemLocation = { ...lisbon, id: 'f-pt-other', name: 'Other locations in Portugal' };

describe('rateOn', () => {
  it('handles seasons that wrap the new year', () => {
    expect(rateOn(azores, '2027-01-15').lodging).toBe(139);
    expect(rateOn(azores, '2027-11-01').lodging).toBe(139);
    expect(rateOn(azores, '2027-10-31').lodging).toBe(178);
  });
  it('uses Feb 28 rates on leap day', () => {
    expect(rateOn(boston, '2028-02-29').lodging).toBe(213);
  });
});

describe('estimate', () => {
  it('counts nights as days minus one and scales by the percentage', () => {
    const e = estimate(lisbon, dateRange('2027-05-10', '2027-05-15'), 75);
    expect(e.nights).toBe(5);
    expect(e.days).toBe(6);
    expect(e.lodgingTotal).toBeCloseTo(267 * 5 * 0.75);
    expect(e.foodTotal).toBeCloseTo(107 * 6 * 0.75);
    expect(e.lodgingPerNight).toBeCloseTo(200.25);
    expect(e.fullFoodPerDay).toBe(107);
    expect(e.seasonal).toBe(false);
  });
  it('averages across seasons', () => {
    // Nights Feb 27, Feb 28 (213) and Mar 1 (305).
    const e = estimate(boston, dateRange('2027-02-27', '2027-03-02'), 100);
    expect(e.lodgingTotal).toBe(213 * 2 + 305);
    expect(e.seasonal).toBe(true);
  });
});

describe('searchLocations', () => {
  const all = [otherPt, azores, boston, lisbon];
  it('matches name prefixes first, ignoring case and accents', () => {
    expect(searchLocations(all, 'LISBÓN')[0].id).toBe('f-pt-lisbon');
  });
  it('matches country, and puts "Other locations" after real cities', () => {
    expect(searchLocations(all, 'portugal').map((l) => l.id)).toEqual(['f-pt-lisbon', 'f-portugal-ponta-delgada', 'f-pt-other']);
  });
  it('matches words inside multi-city names and counties', () => {
    expect(searchLocations(all, 'cambridge')[0].id).toBe('us-ma-boston-cambridge');
    expect(searchLocations(all, 'suffolk')[0].id).toBe('us-ma-boston-cambridge');
  });
});
