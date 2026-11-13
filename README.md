# Trip Budget

Plan a trip's full cost before you go: set a total budget and travel dates, add fixed costs, and plan each day.

**Live app:** https://julianhburkard.github.io/Budget-Travel/

## Run it

```bash
npm install
npm run dev
```

`npm test` runs the budget-math tests; `npm run build` makes a production build in `dist/`.

## How costs are counted

- **Trip days** include both the start and end dates.
- **Flights and rental cars** are fixed costs. In "Spread fixed costs" mode, each is divided evenly across every trip day. In "On actual dates" mode, flights land on their date and a rental car is split across its rental days. The trip total is the same either way.
- **Food & drinks**: a daily amount set in the summary; you can override it on any single day.
- **Unplanned expenses**: a % (default 10%) added on top of all planned spending.
- **Average cost / day** = planned trip cost (including unplanned) ÷ trip days. **Budget / day** = total budget ÷ trip days.

Trips are saved in the browser's localStorage. There's no account or server yet.

## Code layout

- `src/lib/budget.ts`: all budget math (`summarize`), with tests in `budget.test.ts`
- `src/lib/storage.ts`: trip list and localStorage saving
- `src/components/SummaryHeader.tsx`: budget, dates, stats, flights, and rental cars
- `src/components/Ledger.tsx`: day-by-day cards and activities
