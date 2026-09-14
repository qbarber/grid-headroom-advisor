# Grid Headroom Advisor

A small AI agent that computes a signable **operating envelope** for a proposed new electrical load against a substation's historical demand profile — modeled on the same core move physics-based grid intelligence tools (e.g. GridCARE, Duke University's curtailment research) make, scoped down to something buildable solo with synthetic data.

**Built for:** developers, hyperscalers, and site-selection teams evaluating an interconnection or flex-connect offer — not the utility granting it, and not an ISO/RTO function.

---

## The Problem

Utilities today plan a substation's capacity around its single worst-case hour — the hour that happens roughly 15 days a year. The other 350 days, that substation typically runs at around half its rated capacity. Treating the doorway as "full" year-round because of 15 hard days is why interconnection queues run 3–7+ years in major markets — projects wait for infrastructure that mostly exists to cover a handful of extreme hours.

Duke University's research puts a number on the opportunity: allowing a new load to curtail just 0.25% of its hours lets the existing U.S. grid absorb 76 GW of new demand with zero new construction — scaling to 126 GW at 1% curtailment. This matters now specifically because AI data center demand is growing faster than transmission can physically be built, so extracting more precision from existing infrastructure is currently cheaper and faster than building more.

The gap this project targets: a developer evaluating a flex-connect offer — "curtail X% of hours, connect years sooner" — either doesn't get that math done rigorously, or takes the utility's number at face value. This gives them an independent read before they sign.

## The Solution

Given a substation's capacity and a proposed load size, the agent:

1. **Generates** a synthetic year of hourly demand (8,760 hours) for a fictional substation, calibrated against both the Duke/GridCARE framing (peaks 80–90% of rated) and standard utility engineering benchmarks (load factor, utilization factor).
2. **Simulates** the combined load against every hour of that year, identifying exactly which hours would breach rated capacity and what curtailment percentage would be required to fit safely.
3. **Decides** — not just calculates — which of three outcomes applies:
   - **Connect now** — no curtailment needed
   - **Flex-connect available** — fits under a defined curtailment threshold, anchored to the Duke research's low-cost curtailment bands
   - **Flag for human review** — curtailment exceeds that threshold, or breaches are spread broadly across the year rather than concentrated in predictable peak hours
4. **Explains** every recommendation in plain English, naming the specific driving hours/scenarios and framing the tradeoff (years faster online vs. curtailment required) — rather than returning a bare number.
5. **Validates** its own decision logic against a hand-verified eval set: 6 hand-crafted boundary cases, 6/6 correct, specifically designed to prove both halves of the escalation logic (curtailment magnitude, and breach breadth) trigger independently as well as together.

The full pipeline is visible in a simple UI: enter a proposed load, see the year's load curve against the capacity line with breaches highlighted, and get the recommendation with its reasoning alongside it.

## Tradeoffs and Decisions

A few of the real decisions made along the way — the parts of this project that involved actual judgment, not just implementation:

**Calibrating synthetic data against two independent references, not one.** The first generated dataset peaked above rated capacity — meaning the substation was already "broken" before any new load was even proposed, which contradicts the entire premise. The fix was validated two ways: against the Duke/GridCARE framing (peak should land 80–90% of rated) and against standard utility engineering terms (load factor ~0.5–0.7, utilization factor ~80–90%). Both checks agreeing gave real confidence the calibration was right, not just plausible-looking.

**A single source of truth for scenario classification, not a duplicated or guessed one.** The scenario generator internally decides which days are "hot-summer-peak" vs. "mild-day," but that decision wasn't originally exposed. Rather than have the simulator re-derive the same classification by re-running the generator's random logic (fragile — silently breaks if the generator ever changes) or infer it heuristically from the data's shape (approximate — can mislabel), the generator now exposes its day classifications directly as a shared fact both modules read from.

**Escalation thresholds anchored to cited research, not arbitrary round numbers.** The 1% curtailment ceiling for "flex-connect" isn't a guess — it's the point where Duke's own research stops describing the tradeoff as clearly low-cost. The second, independent escalation trigger — breaches spanning all three scenario types rather than being concentrated in predictable peak hours — reflects a real qualitative difference: broad-based stress on a substation is a different (and riskier) problem than "curtail during known summer afternoons."

**Curtailment is modeled as all-or-nothing per hour, not partial.** An hour either breaches capacity (full curtailment needed) or it doesn't — there's no modeled option for partial dispatch. This is a deliberate simplification to prove the core decision-making concept without also solving a harder optimization problem. A production version would likely allow partial curtailment, which would lower the required percentage overall.

**The tradeoff numbers stay honest about what they don't know.** `yearsFaster` is anchored to a cited external claim (flexible connections come online 3-5 years sooner, per industry reporting) rather than calculated by the agent. `curtailmentCostEstimate` is deliberately qualitative — "negligible / minor / moderate" — rather than a fabricated dollar figure, since actual cost depends on the load's real revenue-per-hour, which this project doesn't model. For the most severe cases (breaches spanning all three scenario types), `yearsFaster` is set to null entirely rather than implying a flex-connect deal that the data doesn't actually support — the honest answer there is closer to "a different site is likely a better fit."

**Caught and fixed a real internal contradiction before committing.** An early version of the explainability layer described severe-breach cases as "concentrated in hot-summer-peak hours" in its main explanation while a separate field correctly said breaches were "broad-based across all scenario types" — two fields telling different stories about the same result. The fix conditioned the explanation's framing on the same signal already driving the escalation decision, rather than adding new special-case logic.

**Eval cases were hand-crafted, not reused random data.** Testing the decision logic against more outputs from the same random generator would only re-verify "does the code still do what it already did." The eval set instead uses six simple, deterministic profiles built specifically so the correct answer could be verified by hand arithmetic before the agent ever ran — including two cases built specifically to isolate each half of the escalation logic's OR condition independently.

## What This Proves — and Doesn't

**What synthetic data does not prove:** that this works on a real grid. Real substation data has messiness synthetic data won't reproduce — sensor noise, missing readings, weather/demand correlations, equipment-specific quirks. This project makes no claim of production-grade accuracy.

**What it does prove:**
- Correctness against ground truth is verifiable, because the ground truth is controlled and computed by hand in advance — not a fuzzier "does this look plausible" judgment.
- The decision logic is inspectable, not a black box — every recommendation carries a `reasoningTrace` showing exactly which condition fired and why.
- It demonstrates an understanding of what validation actually requires — many AI portfolio projects ship a demo with no eval at all. This one has a measured, hand-verified accuracy number covering every decision branch.

## What I Learned

**Cross-phase consistency checks are a stronger validation signal than any single number.** While reviewing outputs by hand, a 20 MW proposed load's curtailment result (2.432%) turned out to exactly match a statistic the data generator had already reported independently ("hours ≥ 80% of rated: 2.43% of year") — two different phases, two different computations, same answer. That kind of internal agreement, found by checking the math rather than assumed, builds more trust than either number alone.

**An agent's value is in the boundary it draws, not the calculation underneath it.** The actual product-design decision in this project isn't the curtailment math — it's where the line sits between "safe to auto-approve" and "needs a human." Making that boundary explicit, inspectable, and defensible was harder and more interesting than the arithmetic.

**Real commit-and-push discipline is a safety net, not just a portfolio nicety.** Partway through the final phase, a platform tool unrelated to this project's own code deleted the local git history entirely. Nothing was lost, because every prior phase had already been pushed to GitHub individually rather than accumulated locally. A good practice adopted for portfolio-optics reasons turned out to matter for a completely different, more serious reason.

**Honest limitations are a feature, not a hedge.** Stating plainly what synthetic data can't prove, keeping cost estimates qualitative instead of inventing precision, and nulling out a "years faster" estimate rather than implying a deal that isn't real — all of these were choices to under-claim rather than over-claim, on the theory that a reviewer trusts a project more, not less, for drawing its own limits clearly.

## Demo

*[Add link to demo GIF/Loom here — 60-90 second walkthrough of the connect_now / flex_connect / flag_for_review cases]*

---

## Project Structure

| Path | Purpose |
|---|---|
| `src/data/patterns.js` | Three named load-shape patterns (normal weekday/weekend, hot-summer-peak, mild-day), composed **additively** — normal sets the baseline, hot-summer-peak adds a bounded mid-July afternoon surge, mild-day subtracts on cooler days. Each stays independently tunable. |
| `src/data/generator.js` | `generateSubstation()` — composes the patterns + noise into a `Substation` with 8,760 hourly load values, seeded for reproducibility. Exposes `scenarioDays` (which days got which pattern) so later phases can label constrained hours without re-deriving the seeded RNG. |
| `src/simulation/envelopeSimulator.js` | `simulateEnvelope()` — layers a `ProposedLoad` onto a substation and reports where it breaks the rating, the curtailment needed, and the hours/scenarios driving the breach. |
| `src/agent/decisionEngine.js` | `decideRecommendation()` — the escalation logic: `connect_now` / `flex_connect` / `flag_for_review`, with an inspectable `reasoningTrace` showing exactly which threshold fired. |
| `src/agent/explainability.js` | `explainRecommendation()` — adds `explanation`, `drivingScenarioSummary`, and `tradeoff` ({ yearsFaster, curtailmentCostEstimate }) to the decision, in plain English. |
| `src/eval/testCases.js` | Six hand-crafted, deterministic test substations with hand-computed expected outcomes — not reused random data — specifically built to isolate each half of the escalation logic's OR condition. |
| `scripts/runEval.js` | Runs the full pipeline against all six eval cases, reports per-case match and overall accuracy (6/6, 100%). |
| `scripts/generateSample.js` / `simulateSample.js` / `decideSample.js` | Sanity-check scripts for Phases 1–4, console/JSON output only. |
| `client/` | React + Vite + Tailwind + Recharts frontend — input form, load-vs-capacity chart, decision card, eval summary panel. |

## Data Shapes

```js
/**
 * @typedef {Object} Substation
 * @property {string} id
 * @property {string} name
 * @property {number} ratedCapacityMW
 * @property {number[]} hourlyLoadProfile  // 8760 values, one per hour of a year
 * @property {{ hotDays: number[], mildDays: number[] }} scenarioDays
 */

/**
 * @typedef {Object} ProposedLoad
 * @property {string}  substationId
 * @property {number}  sizeMW
 * @property {boolean} flexibilityAvailable
 */

/**
 * @typedef {Object} OperatingEnvelope
 * @property {string}   substationId
 * @property {number}   proposedLoadMW
 * @property {number}   hoursExceedingCapacity
 * @property {number}   curtailmentPercent      // share of the year, 0..100
 * @property {string[]} drivingScenarios        // 'normal' | 'hot-summer-peak' | 'mild-day'
 * @property {{ day: number, hour: number, combinedLoadMW: number }[]} topConstrainedHours
 * @property {'connect_now'|'flex_connect'|'flag_for_review'} recommendation
 * @property {string[]} reasoningTrace
 * @property {string}   explanation
 * @property {string}   drivingScenarioSummary
 * @property {{ yearsFaster: number|null, curtailmentCostEstimate: string }} tradeoff
 */
```

## Example Output

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

```js
const { generateSubstation } = require('./src/data/generator');
const substation = generateSubstation({
  id: 'SUB-001', name: 'Test Substation', ratedCapacityMW: 100, seed: 42,
});

const { simulateEnvelope } = require('./src/simulation/envelopeSimulator');
simulateEnvelope(substation, { substationId: 'SUB-001', sizeMW: 15, flexibilityAvailable: true });
// -> { hoursExceedingCapacity: 22, curtailmentPercent: 0.251,
//      drivingScenarios: ['normal', 'hot-summer-peak'],
//      topConstrainedHours: [{ day: 195, hour: 14, combinedLoadMW: 104.006 }, ...] }

const { decideRecommendation } = require('./src/agent/decisionEngine');
const decided = decideRecommendation(/* result above */);
// -> adds recommendation: 'flex_connect', reasoningTrace: [...]

const { explainRecommendation } = require('./src/agent/explainability');
explainRecommendation(decided);
// -> adds explanation: '...', drivingScenarioSummary: '...', tradeoff: {...}
```

## Running It

```bash
# Install
npm install                         # backend deps
cd client && npm install && cd ..   # frontend deps

npm run generate:sample   # Phase 1 sanity check
npm run simulate:sample   # Phase 2 sanity check
npm run decide:sample     # Phase 3-4 sanity check
npm run eval               # Phase 5 — full accuracy report

# Full app — starts both Express (:3001) and React (:5173) together
npm run dev
```

## Non-Goals

- No real SCADA/AMI utility data, and no claim of production-grade accuracy
- No database or persistence layer — nothing here needs to survive past a single run
- Not a claim that this replicates or competes with production tools like GridCARE
