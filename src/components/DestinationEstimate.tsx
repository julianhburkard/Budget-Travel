import { useEffect, useMemo, useState } from 'react';
import type { TripSummary } from '../lib/budget';
import { money, moneyRounded } from '../lib/format';
import { estimate, loadPerDiem, locationLabel, type PerDiemData } from '../lib/perDiem';
import { newId } from '../lib/storage';
import type { Trip } from '../lib/types';
import { CityPicker } from './CityPicker';
import { NumberInput } from './inputs';

interface Props {
  trip: Trip;
  summary: TripSummary;
  onChange: (fn: (t: Trip) => Trip) => void;
}

export function DestinationEstimate({ trip, summary, onChange }: Props) {
  const [data, setData] = useState<PerDiemData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadPerDiem().then(setData, () => setError(true));
  }, []);

  const loc = useMemo(() => data?.locations.find((l) => l.id === trip.destination?.locationId) ?? null, [data, trip.destination]);
  const est = useMemo(() => (loc && summary.dayCount ? estimate(loc, summary.days, trip.perDiemPct) : null), [loc, summary.days, summary.dayCount, trip.perDiemPct]);

  const foodRounded = est ? Math.round(est.foodPerDay) : 0;
  const lodgingRounded = est ? Math.round(est.lodgingTotal) : 0;
  const estimatedStay = trip.lodging.find((l) => l.fromEstimate);
  const foodApplied = est !== null && trip.foodPerDay === foodRounded;
  const lodgingApplied =
    estimatedStay !== undefined &&
    estimatedStay.cost === lodgingRounded &&
    estimatedStay.checkIn === trip.startDate &&
    estimatedStay.checkOut === trip.endDate;

  const applyFood = () => onChange((t) => ({ ...t, foodPerDay: foodRounded }));
  const applyLodging = () =>
    onChange((t) => {
      const stay = {
        label: `Lodging, ${loc!.name}`,
        checkIn: t.startDate,
        checkOut: t.endDate,
        cost: lodgingRounded,
        fromEstimate: true,
      };
      const existing = t.lodging.find((l) => l.fromEstimate);
      return {
        ...t,
        lodging: existing ? t.lodging.map((l) => (l.id === existing.id ? { ...l, ...stay } : l)) : [...t.lodging, { id: newId(), ...stay }],
      };
    });

  return (
    <section className="card estimate">
      <div className="estimate-head">
        <h2>Destination estimate</h2>
        <span className="muted small">Based on U.S. government per diem rates for business travel</span>
      </div>

      <div className="estimate-controls">
        <div className="field grow">
          <span className="field-label">Destination</span>
          {data ? (
            <CityPicker
              locations={data.locations}
              selectedLabel={trip.destination?.label ?? ''}
              onSelect={(l) => onChange((t) => ({ ...t, destination: { locationId: l.id, label: locationLabel(l) } }))}
              onClear={() => onChange((t) => ({ ...t, destination: null }))}
            />
          ) : (
            <span className="muted small city-loading">{error ? 'Could not load city rates. Refresh the page to try again.' : 'Loading city rates…'}</span>
          )}
        </div>
        <label className="field">
          <span className="field-label">% of business traveler per diem</span>
          <NumberInput prefix="" suffix="%" value={trip.perDiemPct} onChange={(n) => onChange((t) => ({ ...t, perDiemPct: Math.min(n, 200) }))} />
        </label>
      </div>

      {!trip.destination && data && (
        <p className="muted small estimate-hint">
          Pick where you're going to see typical lodging and food costs there. Government per diem rates are set for business travelers, so they run high;
          75% is a reasonable starting point for leisure travel.
        </p>
      )}

      {trip.destination && data && !loc && <p className="muted small">That city is no longer in the rate list. Search for it again.</p>}

      {data && loc && est && (
        <>
          <div className="estimate-grid">
            <EstimateTile
              title="Lodging"
              cat="lodging"
              perUnit={est.lodgingPerNight}
              unit="night"
              full={est.fullLodgingPerNight}
              total={est.lodgingTotal}
              countLabel={`${est.nights} night${est.nights === 1 ? '' : 's'}`}
              actionLabel={estimatedStay ? 'Update lodging' : 'Add as lodging'}
              applied={lodgingApplied}
              disabled={est.nights === 0}
              onApply={applyLodging}
            />
            <EstimateTile
              title="Meals & incidentals"
              cat="food"
              perUnit={est.foodPerDay}
              unit="day"
              full={est.fullFoodPerDay}
              total={est.foodTotal}
              countLabel={`${est.days} day${est.days === 1 ? '' : 's'}`}
              actionLabel="Use for food & drinks"
              applied={foodApplied}
              onApply={applyFood}
            />
            <div className="estimate-tile total-tile">
              <span className="stat-label">Lodging + meals estimate</span>
              <span className="stat-value">{moneyRounded(est.lodgingTotal + est.foodTotal)}</span>
              <span className="stat-hint">
                {est.days} days in {loc.name} at {trip.perDiemPct}% of per diem
              </span>
            </div>
          </div>
          <p className="muted small estimate-source">
            {est.seasonal && 'Rates change during your dates (seasonal pricing), so these are averages. '}
            Meals & incidentals include tips and small fees. Source:{' '}
            {loc.kind === 'foreign' ? (
              <a href={data.sources.foreign.url} target="_blank" rel="noreferrer">
                U.S. State Department foreign per diem rates
              </a>
            ) : (
              <a href={data.sources.us.url} target="_blank" rel="noreferrer">
                GSA per diem rates, FY{data.sources.us.fiscalYear}
              </a>
            )}
            {loc.kind === 'foreign' && data.sources.foreign.effectiveDate && `, effective ${data.sources.foreign.effectiveDate}`}. Updated{' '}
            {data.generatedAt}.
          </p>
        </>
      )}
    </section>
  );
}

interface TileProps {
  title: string;
  cat: 'lodging' | 'food';
  perUnit: number;
  unit: string;
  full: number;
  total: number;
  countLabel: string;
  actionLabel: string;
  applied: boolean;
  disabled?: boolean;
  onApply: () => void;
}

function EstimateTile(p: TileProps) {
  return (
    <div className="estimate-tile">
      <span className="stat-label">
        <span className={`dot cat-${p.cat}`} /> {p.title}
      </span>
      <span className="stat-value">
        {moneyRounded(p.perUnit)}
        <span className="per-unit"> / {p.unit}</span>
      </span>
      <span className="stat-hint">
        Full per diem {money(Math.round(p.full))} / {p.unit} · {moneyRounded(p.total)} for {p.countLabel}
      </span>
      <button className={`btn ${p.applied ? 'ghost applied' : ''}`} onClick={p.onApply} disabled={p.applied || p.disabled}>
        {p.applied ? '✓ In your budget' : p.actionLabel}
      </button>
    </div>
  );
}
