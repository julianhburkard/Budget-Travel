import { useMemo } from 'react';
import { Ledger } from './components/Ledger';
import { SummaryHeader } from './components/SummaryHeader';
import { summarize } from './lib/budget';
import { moneyRounded } from './lib/format';
import { useTrips } from './lib/storage';
import type { Trip } from './lib/types';

export default function App() {
  const store = useTrips();
  const trip = store.selected;
  const summary = useMemo(() => summarize(trip), [trip]);
  const update = (fn: (t: Trip) => Trip) => store.update(trip.id, fn);

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Trip Budget</span>
        <nav className="trip-tabs" aria-label="Trips">
          {store.trips.map((t) => (
            <button key={t.id} className={`trip-tab ${t.id === trip.id ? 'on' : ''}`} onClick={() => store.select(t.id)}>
              {t.name || 'Untitled trip'}
            </button>
          ))}
          <button className="trip-tab add" onClick={store.add}>
            + New trip
          </button>
        </nav>
      </header>

      <main>
        <div className="trip-title-row">
          <input
            className="trip-title"
            value={trip.name}
            placeholder="Trip name"
            aria-label="Trip name"
            onChange={(e) => update((t) => ({ ...t, name: e.target.value }))}
          />
          <div className="trip-actions">
            <button className="btn ghost" onClick={() => store.duplicate(trip.id)}>
              Duplicate
            </button>
            <button
              className="btn ghost danger"
              onClick={() => {
                if (confirm(`Delete "${trip.name}"? This can't be undone.`)) store.remove(trip.id);
              }}
            >
              Delete
            </button>
          </div>
        </div>

        <SummaryHeader trip={trip} summary={summary} onChange={update} />
        <Ledger trip={trip} summary={summary} onChange={update} />
      </main>

      <footer className="muted small">
        {store.trips.length} trip{store.trips.length === 1 ? '' : 's'} · {moneyRounded(summary.plannedTotal)} planned for {trip.name || 'this trip'} ·
        saved in this browser
      </footer>
    </div>
  );
}
