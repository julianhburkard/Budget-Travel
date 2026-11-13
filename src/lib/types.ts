/** Dates are stored as ISO calendar dates: "YYYY-MM-DD". */
export type ISODate = string;

export interface Flight {
  id: string;
  label: string;
  date: ISODate;
  cost: number;
}

export interface RentalCar {
  id: string;
  label: string;
  startDate: ISODate;
  endDate: ISODate;
  cost: number;
}

export interface Activity {
  id: string;
  date: ISODate;
  name: string;
  cost: number;
}

/**
 * How fixed costs (flights, rental cars) are placed in the daily ledger.
 * - "spread": divided evenly across every day of the trip
 * - "actual": flights on their date, rental cars across their rental days
 * The trip total is the same in both modes.
 */
export type FixedCostMode = 'spread' | 'actual';

export interface Trip {
  id: string;
  name: string;
  totalBudget: number;
  startDate: ISODate;
  endDate: ISODate;
  foodPerDay: number;
  /** Per-day food budget overrides, keyed by date. */
  foodOverrides: Record<ISODate, number>;
  /** Unplanned expenses buffer, as a percent of planned spending. */
  bufferPct: number;
  flights: Flight[];
  rentalCars: RentalCar[];
  activities: Activity[];
  fixedCostMode: FixedCostMode;
  createdAt: number;
}
