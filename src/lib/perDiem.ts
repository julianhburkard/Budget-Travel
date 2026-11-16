import type { ISODate } from './types';

/** One rate period. start/end are "MM-DD"; a period may wrap the new year (e.g. 11-01 → 03-31). */
export interface PerDiemSeason {
  start: string;
  end: string;
  /** Maximum lodging per night, USD. */
  lodging: number;
  /** Meals & incidental expenses per day, USD. */
  mie: number;
}

export interface PerDiemLocation {
  id: string;
  name: string;
  /** Country (foreign) or state (U.S.). */
  region: string;
  kind: 'foreign' | 'us';
  /** U.S. only: counties the rate covers. */
  area?: string;
  seasons: PerDiemSeason[];
}

export interface PerDiemData {
  generatedAt: string;
  sources: {
    foreign: { name: string; effectiveDate: string | null; url: string };
    us: { name: string; fiscalYear: number; url: string };
  };
  locations: PerDiemLocation[];
}

export const locationLabel = (l: PerDiemLocation) => (l.name.startsWith('Other locations in') ? l.name : `${l.name}, ${l.region}`);

function inSeason(md: string, s: PerDiemSeason): boolean {
  return s.start <= s.end ? md >= s.start && md <= s.end : md >= s.start || md <= s.end;
}

/** The rate that applies on a date. Feb 29 uses Feb 28's rate. */
export function rateOn(loc: PerDiemLocation, date: ISODate): PerDiemSeason {
  let md = date.slice(5);
  if (md === '02-29') md = '02-28';
  return loc.seasons.find((s) => inSeason(md, s)) ?? loc.seasons[0];
}

export interface PerDiemEstimate {
  nights: number;
  days: number;
  /** Totals for the trip at the chosen percentage. */
  lodgingTotal: number;
  foodTotal: number;
  /** Averages at the chosen percentage. */
  lodgingPerNight: number;
  foodPerDay: number;
  /** Averages at 100% of per diem, for reference. */
  fullLodgingPerNight: number;
  fullFoodPerDay: number;
  /** True when the rate changes during the trip (seasonal pricing). */
  seasonal: boolean;
}

/**
 * Estimate lodging and food for a trip.
 * Nights are every trip day except the last; food is every trip day.
 */
export function estimate(loc: PerDiemLocation, days: ISODate[], pct: number): PerDiemEstimate {
  const f = Math.max(0, pct) / 100;
  const nights = days.slice(0, -1);
  const nightRates = nights.map((d) => rateOn(loc, d).lodging);
  const dayRates = days.map((d) => rateOn(loc, d).mie);
  const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
  const fullLodging = sum(nightRates);
  const fullFood = sum(dayRates);
  const avg = (total: number, count: number) => (count ? total / count : 0);
  const seasonal = new Set(days.map((d) => rateOn(loc, d))).size > 1;
  return {
    nights: nights.length,
    days: days.length,
    lodgingTotal: fullLodging * f,
    foodTotal: fullFood * f,
    lodgingPerNight: avg(fullLodging, nights.length) * f,
    foodPerDay: avg(fullFood, days.length) * f,
    fullLodgingPerNight: avg(fullLodging, nights.length),
    fullFoodPerDay: avg(fullFood, days.length),
    seasonal,
  };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Rank locations against a search query: name prefix, then word prefix, then anywhere (incl. country/state/county). */
export function searchLocations(locations: PerDiemLocation[], query: string, limit = 8): PerDiemLocation[] {
  const q = norm(query);
  if (!q) return [];
  const scored: { loc: PerDiemLocation; score: number }[] = [];
  for (const loc of locations) {
    const isOther = loc.name.startsWith('Other locations');
    // "Other locations in X" should match on X like a region, not rank like a city named X.
    const name = isOther ? '' : norm(loc.name);
    const all = `${name} ${norm(loc.region)} ${norm(loc.area ?? '')} ${isOther ? 'other' : ''}`;
    let score = -1;
    if (name && name.startsWith(q)) score = 0;
    else if (name && (' ' + name).includes(' ' + q)) score = 1;
    else if (all.includes(q)) score = 2;
    else if (q.split(' ').every((w) => all.includes(w))) score = 3;
    // Fallback "Other locations in …" entries sort after real cities.
    if (score >= 0) scored.push({ loc, score: score * 2 + (isOther ? 1 : 0) });
  }
  scored.sort((a, b) => a.score - b.score || a.loc.name.length - b.loc.name.length || a.loc.name.localeCompare(b.loc.name));
  return scored.slice(0, limit).map((s) => s.loc);
}

let cache: Promise<PerDiemData> | null = null;

/** Load the bundled per diem dataset once (it's ~250 KB, so it isn't part of the main bundle). */
export function loadPerDiem(): Promise<PerDiemData> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/per-diem.json`).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<PerDiemData>;
  });
  cache.catch(() => (cache = null)); // allow a retry after a failure
  return cache;
}
