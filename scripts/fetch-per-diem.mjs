#!/usr/bin/env node
/**
 * Downloads U.S. government per diem rates and writes public/data/per-diem.json.
 *
 *  - Foreign cities: U.S. State Department maximum per diem rates (all locations, one request).
 *  - U.S. cities:    GSA CONUS per diem rates for the current federal fiscal year.
 *
 * Usage: node scripts/fetch-per-diem.mjs
 * Env:   GSA_API_KEY  (free key from https://api.data.gov/signup; falls back to DEMO_KEY)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/per-diem.json');
const STATE_URL = 'https://allowances.state.gov/web920/per_diem_action.asp';
const GSA_KEY = process.env.GSA_API_KEY || 'DEMO_KEY';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const STATES = {
  AL: 'Alabama', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

/** "SAO TOME AND PRINCIPE" -> "Sao Tome and Principe" */
const titleCase = (s) =>
  s.toLowerCase().replace(/(^|[\s\-(/.'])([a-z])/g, (_, p, c) => p + c.toUpperCase()).replace(/\b(And|Of|The|Da|De|Du)\b/g, (w, _x, i) => (i === 0 ? w : w.toLowerCase()));

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** "04/01" -> "04-01" */
const mmdd = (s) => s.replace('/', '-');

async function fetchForeign() {
  const res = await fetch(STATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0 (trip-budget data refresh)' },
    body: 'MenuHide=1&CountryCode=0000',
  });
  if (!res.ok) throw new Error(`State Dept request failed: HTTP ${res.status}`);
  const html = new TextDecoder('latin1').decode(await res.arrayBuffer());

  const byKey = new Map();
  let effective = ''; // newest "effective date" seen, as YYYY-MM-DD
  for (const [, row] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => decode(m[1]));
    if (cells.length < 9) continue;
    const [country, post, begin, end, lodging, mie, , , eff] = cells;
    if (!/^\d\d\/\d\d$/.test(begin) || !/^\d\d\/\d\d$/.test(end)) continue;
    const l = Number(lodging);
    const m = Number(mie);
    if (!Number.isFinite(l) || !Number.isFinite(m)) continue;
    const [em, ed, ey] = eff.split('/');
    if (ey && `${ey}-${em}-${ed}` > effective) effective = `${ey}-${em}-${ed}`;

    // "BAHAMAS, THE" -> "Bahamas"
    const countryName = titleCase(country.replace(/,\s*THE$/i, ''));
    const isOther = /^other$/i.test(post);
    const name = isOther ? `Other locations in ${countryName}` : post;
    const key = `${country}|${post}`;
    if (!byKey.has(key)) {
      byKey.set(key, { id: `f-${slug(countryName)}-${slug(post)}`, name, region: countryName, kind: 'foreign', seasons: [] });
    }
    byKey.get(key).seasons.push({ start: mmdd(begin), end: mmdd(end), lodging: l, mie: m });
  }

  const locations = [...byKey.values()];
  if (locations.length < 500) throw new Error(`State Dept data looks incomplete: only ${locations.length} locations parsed`);
  return { locations, effectiveDate: effective || null };
}

/** Federal fiscal year: Oct 1 starts the next FY. */
function currentFiscalYear(now = new Date()) {
  return now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
}

async function fetchUS() {
  const fy = currentFiscalYear();
  const url = `https://api.gsa.gov/travel/perdiem/v2/rates/conus/lodging/${fy}?api_key=${GSA_KEY}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`GSA request failed: HTTP ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length < 200) throw new Error(`GSA data looks incomplete: ${Array.isArray(rows) ? rows.length : 'not a list'}`);

  const locations = [];
  const seen = new Set();
  for (const r of rows) {
    const state = STATES[r.State] ?? r.State;
    const isStandard = /standard rate/i.test(r.City);
    // Every state repeats the national standard rate; keep one entry per state as "Other locations in <state>".
    const name = isStandard ? `Other locations in ${state}` : r.City;
    const id = `us-${slug(r.State)}-${isStandard ? 'other' : slug(r.City)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    // Compress the 12 monthly lodging rates into seasons of consecutive months with the same rate.
    const mie = Number(r.Meals);
    const seasons = [];
    MONTHS.forEach((m, i) => {
      const lodging = Number(r[m]);
      const last = seasons[seasons.length - 1];
      const end = `${String(i + 1).padStart(2, '0')}-${DAYS_IN_MONTH[i]}`;
      if (last && last.lodging === lodging) last.end = end;
      else seasons.push({ start: `${String(i + 1).padStart(2, '0')}-01`, end, lodging, mie });
    });
    locations.push({
      id,
      name,
      region: state,
      kind: 'us',
      // Counties covered, shown as a hint and used for search.
      ...(r.County && !isStandard ? { area: r.County } : {}),
      seasons,
    });
  }
  return { locations, fiscalYear: fy };
}

const [foreign, us] = await Promise.all([fetchForeign(), fetchUS()]);
const locations = [...us.locations, ...foreign.locations].sort((a, b) => a.name.localeCompare(b.name) || a.region.localeCompare(b.region));

const data = {
  generatedAt: new Date().toISOString().slice(0, 10),
  sources: {
    foreign: { name: 'U.S. Department of State foreign per diem rates', effectiveDate: foreign.effectiveDate, url: 'https://allowances.state.gov/web920/per_diem.asp' },
    us: { name: 'GSA per diem rates (continental U.S.)', fiscalYear: us.fiscalYear, url: 'https://www.gsa.gov/travel/plan-book/per-diem-rates' },
  },
  locations,
};

await mkdir(dirname(OUT), { recursive: true });
// One location per line: compact, but rate changes show up as readable git diffs,
// and the refresh workflow can ignore the generatedAt line when checking for changes.
const json = [
  '{',
  `"generatedAt": ${JSON.stringify(data.generatedAt)},`,
  `"sources": ${JSON.stringify(data.sources)},`,
  '"locations": [',
  data.locations.map((l) => JSON.stringify(l)).join(',\n'),
  ']}',
  '',
].join('\n');
JSON.parse(json); // sanity check
await writeFile(OUT, json);
console.log(`Wrote ${locations.length} locations (${foreign.locations.length} foreign, ${us.locations.length} U.S.) to ${OUT}`);
