# Grid Headroom Advisor

A portfolio project exploring how much spare capacity ("headroom") an electricity
grid substation has, and how that headroom holds up under stress scenarios.

> **Status: Phase 2** — synthetic scenario generator plus the envelope simulator.
> Still no UI, database, or HTTP server. Later phases add an agent/decision module
> (the recommendation), an eval module, and a React client.

## What's here now

| Path | Purpose |
| --- | --- |
| `src/data/patterns.js` | Three named load-shape patterns (normal weekday/weekend, hot-summer-peak, mild-day), each a parameterized sine shape. |
| `src/data/generator.js` | `generateSubstation()` — composes the patterns + noise into a `Substation` with 8760 hourly load values. |
| `src/simulation/envelopeSimulator.js` | `simulateEnvelope()` — layers a `ProposedLoad` onto a substation and reports where it breaks the rating, the curtailment needed, and the hours/scenarios driving the breach. |
| `scripts/generateSample.js` | Sanity-check script: generates one 100 MW substation and prints summary stats. |
| `scripts/simulateSample.js` | Sanity-check script: runs the simulator against small / medium / large proposed loads and prints each result. |

## The data shape

```js
/**
 * @typedef {Object} Substation
 * @property {string} id
 * @property {string} name
 * @property {number} ratedCapacityMW
 * @property {number[]} hourlyLoadProfile  // 8760 values, one per hour of a year
 * @property {{ hotDays: number[], mildDays: number[] }} scenarioDays
 *           // which day-of-year values got the hot-summer-peak / mild-day pattern
 */

/**
 * @typedef {Object} ProposedLoad
 * @property {string}  substationId
 * @property {number}  sizeMW
 * @property {boolean} flexibilityAvailable  // used by the Phase 3 decision logic
 */

// simulateEnvelope() returns a *partial* OperatingEnvelope — the numbers only,
// no recommendation (Phase 3) or plain-English explanation (Phase 4):
/**
 * @typedef {Object} PartialOperatingEnvelope
 * @property {string}   substationId
 * @property {number}   proposedLoadMW
 * @property {number}   hoursExceedingCapacity
 * @property {number}   curtailmentPercent    // share of the year, 0..100
 * @property {string[]} drivingScenarios      // 'normal' | 'hot-summer-peak' | 'mild-day'
 * @property {{ day: number, hour: number, combinedLoadMW: number }[]} topConstrainedHours
 */
```

## Running it

```bash
npm install
npm run generate:sample   # or: node scripts/generateSample.js
npm run simulate:sample   # or: node scripts/simulateSample.js
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

`simulateEnvelope()` then layers a proposed load onto that year:

```js
const { simulateEnvelope } = require('./src/simulation/envelopeSimulator');

simulateEnvelope(substation, {
  substationId: 'SUB-001',
  sizeMW: 15,
  flexibilityAvailable: true,
});
// -> { hoursExceedingCapacity: 22, curtailmentPercent: 0.251,
//      drivingScenarios: ['normal', 'hot-summer-peak'],
//      topConstrainedHours: [{ day: 195, hour: 14, combinedLoadMW: 104.006 }, ...] }
```

`npm run simulate:sample` runs three loads against the seeded 100 MW substation.
With ~11 MW of headroom at the annual peak, curtailment scales as expected:
**5 MW** needs none (0 hours over), **15 MW** needs a trace (0.25% of the year,
all on July afternoons), and **40 MW** needs heavy curtailment (~39% of the year,
now spilling into normal and mild days).

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
- **Curtailment as a share of the whole year.** The proposed load is modelled as
  running every hour, so `curtailmentPercent` is simply the fraction of the 8760
  hours where the combined load would exceed the rating — the hours the new load
  would have to shed or shift. Flexible vs. firm load, and whether that
  curtailment is acceptable, is a Phase 3 decision; the simulator only reports the
  number.
- **Scenario days exposed by the generator.** `generateSubstation()` now returns
  the `hotDays` / `mildDays` it picked, so the simulator can name which pattern a
  constrained hour belongs to without re-deriving the seeded RNG. Behaviour of the
  generated profile is unchanged.
