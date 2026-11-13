import { CATEGORY_LABELS, type Category, type TripSummary } from '../lib/budget';
import { money, moneyRounded } from '../lib/format';
import { newId } from '../lib/storage';
import type { Trip } from '../lib/types';
import { NumberInput } from './inputs';

interface Props {
  trip: Trip;
  summary: TripSummary;
  onChange: (fn: (t: Trip) => Trip) => void;
}

const ORDER: Category[] = ['flights', 'car', 'food', 'activities', 'buffer'];

export function SummaryHeader({ trip, summary, onChange }: Props) {
  const set = <K extends keyof Trip>(key: K, value: Trip[K]) => onChange((t) => ({ ...t, [key]: value }));
  const over = summary.remaining < 0;
  const datesValid = summary.dayCount > 0;

  return (
    <section className="card summary">
      <div className="summary-top">
        <label className="field">
          <span className="field-label">Total budget</span>
          <NumberInput className="big" value={trip.totalBudget} onChange={(n) => set('totalBudget', n)} />
        </label>
        <div className="field">
          <span className="field-label">Dates traveling</span>
          <div className="date-pair">
            <input type="date" value={trip.startDate} onChange={(e) => set('startDate', e.target.value)} aria-label="Start date" />
            <span className="muted">→</span>
            <input
              type="date"
              value={trip.endDate}
              min={trip.startDate}
              onChange={(e) => set('endDate', e.target.value)}
              aria-label="End date"
            />
            <span className="pill">{datesValid ? `${summary.dayCount} day${summary.dayCount === 1 ? '' : 's'}` : 'Check dates'}</span>
          </div>
        </div>
      </div>

      <div className="stats">
        <Stat label="Planned trip cost" value={moneyRounded(summary.plannedTotal)} hint={`incl. ${trip.bufferPct}% unplanned`} />
        <Stat
          label={over ? 'Over budget' : 'Left to plan'}
          value={moneyRounded(Math.abs(summary.remaining))}
          tone={over ? 'bad' : 'good'}
        />
        <Stat
          label="Average cost / day"
          value={moneyRounded(summary.avgPerDay)}
          hint="flights & car spread over every day"
          tone={summary.avgPerDay > summary.budgetPerDay ? 'bad' : undefined}
        />
        <Stat label="Budget / day" value={moneyRounded(summary.budgetPerDay)} hint="your target" />
      </div>

      <BudgetBar trip={trip} summary={summary} />

      <div className="settings">
        <div className="settings-row">
          <label className="field">
            <span className="field-label">Food & drinks / day</span>
            <NumberInput value={trip.foodPerDay} onChange={(n) => set('foodPerDay', n)} />
          </label>
          <label className="field">
            <span className="field-label">Unplanned expenses</span>
            <NumberInput prefix="" suffix="%" value={trip.bufferPct} onChange={(n) => set('bufferPct', Math.min(n, 100))} />
          </label>
          <span className="muted small grow">
            Unplanned expenses are a % added on top of everything you've planned ({money(summary.byCategory.buffer)} right now).
          </span>
        </div>

        <div className="fixed-grid">
          <FixedList
            title="Flights"
            empty="No flights yet"
            total={summary.byCategory.flights}
            onAdd={() =>
              set('flights', [
                ...trip.flights,
                { id: newId(), label: trip.flights.length ? 'Return flight' : 'Outbound flight', date: trip.flights.length ? trip.endDate : trip.startDate, cost: 0 },
              ])
            }
          >
            {trip.flights.map((f) => (
              <div className="fixed-item" key={f.id}>
                <input
                  className="text"
                  value={f.label}
                  aria-label="Flight name"
                  onChange={(e) => set('flights', trip.flights.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))}
                />
                <input
                  type="date"
                  value={f.date}
                  aria-label="Flight date"
                  onChange={(e) => set('flights', trip.flights.map((x) => (x.id === f.id ? { ...x, date: e.target.value } : x)))}
                />
                <NumberInput
                  value={f.cost}
                  aria-label="Flight cost"
                  onChange={(n) => set('flights', trip.flights.map((x) => (x.id === f.id ? { ...x, cost: n } : x)))}
                />
                <RemoveButton label={`Remove ${f.label}`} onClick={() => set('flights', trip.flights.filter((x) => x.id !== f.id))} />
              </div>
            ))}
          </FixedList>

          <FixedList
            title="Rental car"
            empty="No rental car"
            total={summary.byCategory.car}
            onAdd={() =>
              set('rentalCars', [
                ...trip.rentalCars,
                { id: newId(), label: 'Rental car', startDate: trip.startDate, endDate: trip.endDate, cost: 0 },
              ])
            }
          >
            {trip.rentalCars.map((c) => {
              const patch = (p: Partial<typeof c>) =>
                set('rentalCars', trip.rentalCars.map((x) => (x.id === c.id ? { ...x, ...p } : x)));
              return (
                <div className="fixed-item car" key={c.id}>
                  <input className="text" value={c.label} aria-label="Rental name" onChange={(e) => patch({ label: e.target.value })} />
                  <span className="date-pair compact">
                    <input type="date" value={c.startDate} aria-label="Pick-up date" onChange={(e) => patch({ startDate: e.target.value })} />
                    <span className="muted">→</span>
                    <input type="date" value={c.endDate} min={c.startDate} aria-label="Drop-off date" onChange={(e) => patch({ endDate: e.target.value })} />
                  </span>
                  <NumberInput value={c.cost} aria-label="Total rental cost" onChange={(n) => patch({ cost: n })} />
                  <RemoveButton label={`Remove ${c.label}`} onClick={() => set('rentalCars', trip.rentalCars.filter((x) => x.id !== c.id))} />
                </div>
              );
            })}
          </FixedList>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

function BudgetBar({ trip, summary }: { trip: Trip; summary: TripSummary }) {
  // Scale to whichever is bigger so an over-budget trip still fits.
  const scale = Math.max(trip.totalBudget, summary.plannedTotal, 1);
  const budgetPos = (trip.totalBudget / scale) * 100;
  return (
    <div className="budget-bar-wrap">
      <div className="budget-bar" role="img" aria-label={`Planned ${money(summary.plannedTotal)} of ${money(trip.totalBudget)} budget`}>
        {ORDER.map((c) => {
          const v = summary.byCategory[c];
          if (v <= 0) return null;
          return <span key={c} className={`seg cat-${c}`} style={{ width: `${(v / scale) * 100}%` }} title={`${CATEGORY_LABELS[c]}: ${money(v)}`} />;
        })}
        {summary.plannedTotal > trip.totalBudget && <span className="budget-marker" style={{ left: `${budgetPos}%` }} title="Your budget" />}
      </div>
      <ul className="legend">
        {ORDER.map((c) => (
          <li key={c}>
            <span className={`dot cat-${c}`} />
            {CATEGORY_LABELS[c]} <strong>{moneyRounded(summary.byCategory[c])}</strong>
          </li>
        ))}
        {summary.remaining > 0 && (
          <li>
            <span className="dot remaining" />
            Left <strong>{moneyRounded(summary.remaining)}</strong>
          </li>
        )}
      </ul>
    </div>
  );
}

function FixedList(props: { title: string; empty: string; total: number; onAdd: () => void; children: React.ReactNode[] }) {
  return (
    <div className="fixed-list">
      <div className="fixed-head">
        <h3>
          {props.title} <span className="muted">{money(props.total)}</span>
        </h3>
        <button className="btn ghost" onClick={props.onAdd}>
          + Add
        </button>
      </div>
      {props.children.length ? props.children : <p className="muted small">{props.empty}</p>}
    </div>
  );
}

export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="icon-btn" aria-label={label} title={label} onClick={onClick}>
      ×
    </button>
  );
}
