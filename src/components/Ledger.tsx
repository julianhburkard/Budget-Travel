import { useState } from 'react';
import { CATEGORY_LABELS, foodForDay, type LedgerDay, type TripSummary } from '../lib/budget';
import { formatDay } from '../lib/dates';
import { money } from '../lib/format';
import { newId } from '../lib/storage';
import type { Activity, FixedCostMode, ISODate, Trip } from '../lib/types';
import { NumberInput } from './inputs';
import { RemoveButton } from './SummaryHeader';

interface Props {
  trip: Trip;
  summary: TripSummary;
  onChange: (fn: (t: Trip) => Trip) => void;
}

export function Ledger({ trip, summary, onChange }: Props) {
  const setMode = (m: FixedCostMode) => onChange((t) => ({ ...t, fixedCostMode: m }));
  const updateActivity = (id: string, patch: Partial<Activity>) =>
    onChange((t) => ({ ...t, activities: t.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  const removeActivity = (id: string) => onChange((t) => ({ ...t, activities: t.activities.filter((a) => a.id !== id) }));
  const addActivity = (date: ISODate, name: string, cost: number) =>
    onChange((t) => ({ ...t, activities: [...t.activities, { id: newId(), date, name, cost }] }));
  const setFood = (date: ISODate, value: number | null) =>
    onChange((t) => {
      const foodOverrides = { ...t.foodOverrides };
      if (value === null || value === t.foodPerDay) delete foodOverrides[date];
      else foodOverrides[date] = value;
      return { ...t, foodOverrides };
    });

  // Bars are scaled to the most expensive day, or the daily budget if that's higher.
  const maxDay = Math.max(summary.budgetPerDay, ...summary.ledger.map((d) => d.total), 1);

  return (
    <section className="ledger">
      <div className="ledger-head">
        <h2>Daily ledger</h2>
        <div className="segmented" role="group" aria-label="How to show flights and rental cars">
          <button className={trip.fixedCostMode === 'spread' ? 'on' : ''} onClick={() => setMode('spread')}>
            Spread fixed costs
          </button>
          <button className={trip.fixedCostMode === 'actual' ? 'on' : ''} onClick={() => setMode('actual')}>
            On actual dates
          </button>
        </div>
      </div>

      {summary.dayCount === 0 && <p className="card muted">Set valid travel dates above to build your daily ledger.</p>}

      <div className="days">
        {summary.ledger.map((day) => (
          <DayCard
            key={day.date}
            day={day}
            trip={trip}
            budgetPerDay={summary.budgetPerDay}
            maxDay={maxDay}
            onAdd={(name, cost) => addActivity(day.date, name, cost)}
            onUpdateActivity={updateActivity}
            onRemoveActivity={removeActivity}
            onSetFood={(v) => setFood(day.date, v)}
          />
        ))}
      </div>

      {summary.strayActivities.length > 0 && (
        <div className="card stray">
          <h3>Outside your travel dates</h3>
          <p className="muted small">These still count toward your total. Move them to a trip day or remove them.</p>
          {summary.strayActivities.map((a) => (
            <div className="line activity" key={a.id}>
              <input
                type="date"
                value={a.date}
                min={trip.startDate}
                max={trip.endDate}
                aria-label="Activity date"
                onChange={(e) => updateActivity(a.id, { date: e.target.value })}
              />
              <span className="grow">{a.name}</span>
              <span>{money(a.cost)}</span>
              <RemoveButton label={`Remove ${a.name}`} onClick={() => removeActivity(a.id)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

interface DayCardProps {
  day: LedgerDay;
  trip: Trip;
  budgetPerDay: number;
  maxDay: number;
  onAdd: (name: string, cost: number) => void;
  onUpdateActivity: (id: string, patch: Partial<Activity>) => void;
  onRemoveActivity: (id: string) => void;
  onSetFood: (v: number | null) => void;
}

function DayCard({ day, trip, budgetPerDay, maxDay, onAdd, onUpdateActivity, onRemoveActivity, onSetFood }: DayCardProps) {
  const [name, setName] = useState('');
  const [cost, setCost] = useState(0);
  const over = day.total > budgetPerDay;
  const foodOverridden = trip.foodOverrides[day.date] !== undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name.trim(), cost);
    setName('');
    setCost(0);
  };

  return (
    <article className={`card day ${over ? 'over' : ''}`}>
      <header className="day-head">
        <div>
          <span className="day-num">Day {day.index + 1}</span>
          <span className="day-date">{formatDay(day.date)}</span>
        </div>
        <div className="day-total">
          <strong>{money(day.total)}</strong>
          <span className={`small ${over ? 'bad-text' : 'muted'}`}>
            {over ? `${money(day.total - budgetPerDay)} over` : `${money(budgetPerDay - day.total)} under`} daily budget
          </span>
        </div>
      </header>

      <div className="day-bar" aria-hidden>
        {(['flights', 'car', 'food', 'activities'] as const).map((c) => {
          const v = day.lines.filter((l) => l.category === c).reduce((s, l) => s + l.amount, 0);
          return v > 0 ? <span key={c} className={`seg cat-${c}`} style={{ width: `${(v / maxDay) * 100}%` }} /> : null;
        })}
        {day.buffer > 0 && <span className="seg cat-buffer" style={{ width: `${(day.buffer / maxDay) * 100}%` }} />}
        <span className="day-budget-mark" style={{ left: `${Math.min(100, (budgetPerDay / maxDay) * 100)}%` }} title="Daily budget" />
      </div>

      <ul className="lines">
        {day.lines.map((l) => {
          if (l.category === 'food') {
            return (
              <li className="line" key={l.key}>
                <span className="dot cat-food" />
                <span className="grow">
                  {l.label}
                  {foodOverridden && (
                    <button className="link small" onClick={() => onSetFood(null)} title={`Reset to ${money(trip.foodPerDay)}`}>
                      reset
                    </button>
                  )}
                </span>
                <NumberInput className="compact" value={foodForDay(trip, day.date)} onChange={onSetFood} aria-label="Food budget for this day" />
                <span className="icon-spacer" />
              </li>
            );
          }
          if (l.activity) {
            const a = l.activity;
            return (
              <li className="line activity" key={l.key}>
                <span className="dot cat-activities" />
                <input className="text grow" value={a.name} aria-label="Activity name" onChange={(e) => onUpdateActivity(a.id, { name: e.target.value })} />
                <NumberInput className="compact" value={a.cost} aria-label="Activity cost" onChange={(n) => onUpdateActivity(a.id, { cost: n })} />
                <RemoveButton label={`Remove ${a.name}`} onClick={() => onRemoveActivity(a.id)} />
              </li>
            );
          }
          return (
            <li className="line auto" key={l.key} title={`${CATEGORY_LABELS[l.category]}: edit in the summary above`}>
              <span className={`dot cat-${l.category}`} />
              <span className="grow">{l.label}</span>
              <span className="amount">{money(l.amount)}</span>
              <span className="icon-spacer" />
            </li>
          );
        })}
        {trip.bufferPct > 0 && (
          <li className="line auto">
            <span className="dot cat-buffer" />
            <span className="grow">Unplanned ({trip.bufferPct}%)</span>
            <span className="amount">{money(day.buffer)}</span>
            <span className="icon-spacer" />
          </li>
        )}
      </ul>

      <form className="add-activity" onSubmit={submit}>
        <input className="text grow" placeholder="Add an activity…" value={name} onChange={(e) => setName(e.target.value)} />
        <NumberInput className="compact" value={cost} onChange={setCost} aria-label="New activity cost" />
        <button className="btn" type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>
    </article>
  );
}
