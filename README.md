# Grid Headroom Advisor

A portfolio project exploring how much spare capacity ("headroom") an electricity
grid substation has, and how that headroom holds up under stress scenarios.

> **Status: Phase 1** — synthetic scenario generator only. No UI, no database, no
> HTTP server yet. Later phases add a simulation module, an agent/decision module,
> an eval module, and a React client.

## What's here now

| Path | Purpose |
| --- | --- |
| `src/data/patterns.js` | Three named load-shape patterns (normal weekday/weekend, hot-summer-peak, mild-day), each a parameterized sine shape. |
| `src/data/generator.js` | `generateSubstation()` — composes the patterns + noise into a `Substation` with 8760 hourly load values. |
| `scripts/generateSample.js` | Sanity-check script: generates one 100 MW substation and prints summary stats. |

## The data shape

```js
/**
 * @typedef {Object} Substation
 * @property {string} id
 * @property {string} name
 * @property {number} ratedCapacityMW
 * @property {number[]} hourlyLoadProfile  // 8760 values, one per hour of a year
 */
```

## Running it

```bash
npm install
npm run generate:sample   # or: node scripts/generateSample.js
```

Example output:

```
Substation:        Test Substation (SUB-001)
Rated capacity:    100.00 MW
Hours generated:   8760 (OK)

Min hourly load:   21.17 MW
Max hourly load:   89.01 MW  (day 195, hour 14)
Mean hourly load:  54.92 MW  (54.92% of rated)

Hours >= 80% (80.00 MW): 213  (2.43% of year)
Hours >= 100% (100.00 MW): 0  (0.00% of year)

Load factor:         0.617  (mean 54.92 MW / peak 89.01 MW)
Utilization factor:  0.890  (peak 89.01 MW / rated 100.00 MW)
```

The profile is summer-peaking (cooling-driven): load is highest on July afternoons,
where the annual peak of ~89 MW sits — leaving headroom below the 100 MW rating
before any new load is added. The generator is seeded, so a given `seed` always
produces the same year.

```js
const { generateSubstation } = require('./src/data/generator');

const substation = generateSubstation({
  id: 'SUB-001',
  name: 'Test Substation',
  ratedCapacityMW: 100,
  seed: 42,
});
```

## Tradeoffs and decisions

- **Fully synthetic, seeded data.** No real utility feeds or APIs — the year is
  built from three parameterized sine patterns plus noise, and a fixed `seed`
  reproduces it exactly. This keeps Phase 1 self-contained and the scenarios
  deterministic for later simulation/eval work.
- **Patterns composed additively.** `normalWeekdayWeekendPattern` sets the
  baseline, `hotSummerPeakPattern` adds a bounded mid-July afternoon surge, and
  `mildDayPattern` subtracts on cooler days, so each pattern stays independently
  tunable.
- **Sanity-checked against utility engineering norms.** Beyond the grid-headroom
  research this project is based on (the Duke curtailment study and GridCARE's
  work on latent interconnection capacity), the generated year was checked
  against typical distribution-substation figures: its load factor of 0.617 sits
  within the usual ~0.5–0.7 range, and its utilization factor of 0.890 within the
  ~80–90% range utilities plan around. That gave confidence the shape is
  plausible before any new load is layered on in later phases.
