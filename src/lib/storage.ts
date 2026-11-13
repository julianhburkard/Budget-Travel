import { useEffect, useState } from 'react';
import { addDays, todayISO } from './dates';
import type { Trip } from './types';

const KEY = 'trip-budget:v1';

interface Stored {
  trips: Trip[];
  selectedId: string | null;
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function newTrip(name = 'New trip'): Trip {
  const start = addDays(todayISO(), 30);
  return {
    id: newId(),
    name,
    totalBudget: 2000,
    startDate: start,
    endDate: addDays(start, 4),
    foodPerDay: 60,
    foodOverrides: {},
    bufferPct: 10,
    flights: [],
    rentalCars: [],
    activities: [],
    fixedCostMode: 'spread',
    createdAt: Date.now(),
  };
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Stored;
      if (Array.isArray(parsed.trips) && parsed.trips.length) {
        // Fill fields added in later versions so old saves keep working.
        const trips = parsed.trips.map((t) => ({ ...newTrip(), ...t }));
        return { trips, selectedId: parsed.selectedId ?? trips[0].id };
      }
    }
  } catch {
    // Storage unavailable or corrupt: start fresh.
  }
  const first = newTrip('My first trip');
  return { trips: [first], selectedId: first.id };
}

export function useTrips() {
  const [state, setState] = useState<Stored>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Ignore quota / private-mode errors; the app still works for this session.
    }
  }, [state]);

  const selected = state.trips.find((t) => t.id === state.selectedId) ?? state.trips[0];

  return {
    trips: state.trips,
    selected,
    select: (id: string) => setState((s) => ({ ...s, selectedId: id })),
    add: () =>
      setState((s) => {
        const t = newTrip();
        return { trips: [...s.trips, t], selectedId: t.id };
      }),
    update: (id: string, fn: (t: Trip) => Trip) =>
      setState((s) => ({ ...s, trips: s.trips.map((t) => (t.id === id ? fn(t) : t)) })),
    remove: (id: string) =>
      setState((s) => {
        const trips = s.trips.filter((t) => t.id !== id);
        if (!trips.length) trips.push(newTrip());
        return { trips, selectedId: s.selectedId === id ? trips[0].id : s.selectedId };
      }),
    duplicate: (id: string) =>
      setState((s) => {
        const src = s.trips.find((t) => t.id === id);
        if (!src) return s;
        const copy: Trip = { ...structuredClone(src), id: newId(), name: `${src.name} (copy)`, createdAt: Date.now() };
        return { trips: [...s.trips, copy], selectedId: copy.id };
      }),
  };
}
