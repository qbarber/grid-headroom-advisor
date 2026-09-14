'use strict';

/**
 * Hand-crafted eval test cases (Phase 5).
 *
 * Six substations with small, fully explicit hourlyLoadProfile arrays — NOT
 * the random generateSubstation() from Phase 1. Every exceeding hour is
 * placed by hand via buildProfile()'s spike list, so hoursExceedingCapacity
 * (and therefore curtailmentPercent) can be verified by counting, not by
 * trusting a seeded RNG. Each case also hand-declares the expected
 * recommendation and why, so scripts/runEval.js grades against a
 * known-correct answer rather than the agent's own output.
 *
 * Shared constants across every case:
 *   - ratedCapacityMW = 100, proposed load = 10 MW
 *   - baseline hour: 50 + 10 = 60 MW combined -> comfortably under rating
 *   - spike hour:     95 + 10 = 105 MW combined -> 5 MW over rating
 *
 * curtailmentPercent is always hoursExceedingCapacity / 8760 * 100 (see
 * envelopeSimulator.js's HOURS_PER_YEAR) regardless of how short the profile
 * array below is — hours past the end of the array are simply never
 * evaluated, so they count as 0 toward hoursExceedingCapacity. That's what
 * lets these profiles stay a handful of days long while still producing
 * realistic-looking annual percentages.
 *
 * @typedef {import('../data/generator').Substation} Substation
 * @typedef {import('../simulation/envelopeSimulator').ProposedLoad} ProposedLoad
 *
 * @typedef {Object} EvalCase
 * @property {string} label
 * @property {string} expectedRecommendation
 * @property {string} rationale                        why that recommendation is correct,
 *                                                      hand-verifiable from the profile
 * @property {number} expectedHoursExceedingCapacity    hand-counted, cross-checked at eval time
 * @property {Substation} substation
 * @property {ProposedLoad} proposedLoad
 */

const RATED_CAPACITY_MW = 100;
const PROPOSED_LOAD_MW = 10;
const BASELINE_MW = 50; // 50 + 10 = 60 MW combined, well under the 100 MW rating
const SPIKE_MW = 95; // 95 + 10 = 105 MW combined, 5 MW over the 100 MW rating

const HOURS_PER_DAY = 24;

/**
 * Build a small, fully explicit hourlyLoadProfile: `baselineMW` everywhere
 * except the listed spikes, which get `spikeMW`.
 *
 * @param {number} totalDays
 * @param {number} baselineMW
 * @param {{ day: number, hours: number[] | 'all' }[]} spikes
 * @param {number} spikeMW
 * @returns {number[]}
 */
function buildProfile(totalDays, baselineMW, spikes, spikeMW) {
  const profile = new Array(totalDays * HOURS_PER_DAY).fill(baselineMW);
  for (const { day, hours } of spikes) {
    const hourList =
      hours === 'all' ? Array.from({ length: HOURS_PER_DAY }, (_, h) => h) : hours;
    for (const h of hourList) {
      profile[day * HOURS_PER_DAY + h] = spikeMW;
    }
  }
  return profile;
}

/** @type {EvalCase[]} */
const EVAL_CASES = [
  {
    label: '1. Flat low profile, big margin under rated capacity',
    expectedRecommendation: 'connect_now',
    rationale:
      'Combined load is a flat 60 MW (50 baseline + 10 proposed) against a 100 MW rating — ' +
      'no hour ever comes close to breaching, so hoursExceedingCapacity is 0 by construction.',
    expectedHoursExceedingCapacity: 0,
    substation: {
      id: 'EVAL-01',
      name: 'Flat low profile',
      ratedCapacityMW: RATED_CAPACITY_MW,
      hourlyLoadProfile: buildProfile(2, BASELINE_MW, [], SPIKE_MW),
      scenarioDays: { hotDays: [], mildDays: [] },
    },
    proposedLoad: { substationId: 'EVAL-01', sizeMW: PROPOSED_LOAD_MW, flexibilityAvailable: true },
  },
  {
    label: '2. Small spike, curtailment just under 1%, single scenario label',
    expectedRecommendation: 'flex_connect',
    rationale:
      '2 full days (48 hours) of spike, both designated hot-summer-peak days: ' +
      '48 / 8760 * 100 = 0.548% (<= 1.0%), and only 1 scenario label ("hot-summer-peak") is ' +
      'present (< 3) — both flex_connect conditions hold.',
    expectedHoursExceedingCapacity: 48,
    substation: {
      id: 'EVAL-02',
      name: 'Two hot-summer-peak spike days',
      ratedCapacityMW: RATED_CAPACITY_MW,
      hourlyLoadProfile: buildProfile(
        4,
        BASELINE_MW,
        [
          { day: 2, hours: 'all' },
          { day: 3, hours: 'all' },
        ],
        SPIKE_MW,
      ),
      scenarioDays: { hotDays: [2, 3], mildDays: [] },
    },
    proposedLoad: { substationId: 'EVAL-02', sizeMW: PROPOSED_LOAD_MW, flexibilityAvailable: true },
  },
  {
    label: '3. Curtailment boundary — closest achievable value at/under 1.0%',
    expectedRecommendation: 'flex_connect',
    rationale:
      '87 hours of spike: 87 / 8760 * 100 = 0.993%. This is the practical boundary for the ' +
      '<= 1.0 rule: 8760 x 1% = 87.6 hours, not a whole number, so no integer hour count ' +
      'rounds to exactly 1.000%. 87 is the largest count that still rounds to <= 1.0% (88 ' +
      'hours rounds to 1.005% — see case 4, a separate, clearly-over test).',
    expectedHoursExceedingCapacity: 87,
    substation: {
      id: 'EVAL-03',
      name: 'Boundary spike — 87 hours',
      ratedCapacityMW: RATED_CAPACITY_MW,
      hourlyLoadProfile: buildProfile(
        4,
        BASELINE_MW,
        [
          { day: 0, hours: 'all' },
          { day: 1, hours: 'all' },
          { day: 2, hours: 'all' },
          { day: 3, hours: Array.from({ length: 15 }, (_, h) => h) }, // hours 0-14 = 15 hours
        ],
        SPIKE_MW,
      ),
      scenarioDays: { hotDays: [0, 1, 2, 3], mildDays: [] },
    },
    proposedLoad: { substationId: 'EVAL-03', sizeMW: PROPOSED_LOAD_MW, flexibilityAvailable: true },
  },
  {
    label: '4. Curtailment just over 1%, 2 scenario labels — curtailment trigger only',
    expectedRecommendation: 'flag_for_review',
    rationale:
      '4 full spike days (96 hours): 96 / 8760 * 100 = 1.096% (> 1.0%) — the curtailment ' +
      'trigger fires alone. 2 days are designated hot-summer-peak and 2 are unlabeled ' +
      '("normal"), so drivingScenarios.length is 2 (< 3) — the scenario-count trigger does ' +
      'NOT fire, isolating the curtailment-only path to flag_for_review.',
    expectedHoursExceedingCapacity: 96,
    substation: {
      id: 'EVAL-04',
      name: 'Four spike days, two scenario labels',
      ratedCapacityMW: RATED_CAPACITY_MW,
      hourlyLoadProfile: buildProfile(
        4,
        BASELINE_MW,
        [
          { day: 0, hours: 'all' },
          { day: 1, hours: 'all' },
          { day: 2, hours: 'all' },
          { day: 3, hours: 'all' },
        ],
        SPIKE_MW,
      ),
      scenarioDays: { hotDays: [0, 1], mildDays: [] }, // days 2, 3 are unlabeled -> 'normal'
    },
    proposedLoad: { substationId: 'EVAL-04', sizeMW: PROPOSED_LOAD_MW, flexibilityAvailable: true },
  },
  {
    label: '5. Low curtailment, all 3 scenario labels — scenario-count trigger only',
    expectedRecommendation: 'flag_for_review',
    rationale:
      'Only 9 hours of spike (3 per day x 3 days): 9 / 8760 * 100 = 0.103%, well under the ' +
      '1.0% threshold — the curtailment trigger does NOT fire. But those 9 hours split ' +
      'evenly 3/3/3 across normal, hot-summer-peak, and mild-day, so ' +
      'drivingScenarios.length === 3 fires the scenario-count trigger by itself — the one ' +
      'decision branch no earlier sample script (simulateSample.js, decideSample.js) has ' +
      'exercised.',
    expectedHoursExceedingCapacity: 9,
    substation: {
      id: 'EVAL-05',
      name: 'Small spike spread across all 3 scenario labels',
      ratedCapacityMW: RATED_CAPACITY_MW,
      hourlyLoadProfile: buildProfile(
        3,
        BASELINE_MW,
        [
          { day: 0, hours: [10, 11, 12] }, // unlabeled -> 'normal'
          { day: 1, hours: [10, 11, 12] }, // 'hot-summer-peak'
          { day: 2, hours: [10, 11, 12] }, // 'mild-day'
        ],
        SPIKE_MW,
      ),
      scenarioDays: { hotDays: [1], mildDays: [2] },
    },
    proposedLoad: { substationId: 'EVAL-05', sizeMW: PROPOSED_LOAD_MW, flexibilityAvailable: true },
  },
  {
    label: '6. Severe: high curtailment AND all 3 scenario labels — both triggers',
    expectedRecommendation: 'flag_for_review',
    rationale:
      '9 full spike days (216 hours), 3 per scenario label: 216 / 8760 * 100 = 2.466% ' +
      '(> 1.0%) AND drivingScenarios.length === 3 — both triggers fire at once, the most ' +
      'severe branch.',
    expectedHoursExceedingCapacity: 216,
    substation: {
      id: 'EVAL-06',
      name: 'Nine spike days across all 3 scenario labels',
      ratedCapacityMW: RATED_CAPACITY_MW,
      hourlyLoadProfile: buildProfile(
        9,
        BASELINE_MW,
        Array.from({ length: 9 }, (_, day) => ({ day, hours: 'all' })),
        SPIKE_MW,
      ),
      scenarioDays: { hotDays: [3, 4, 5], mildDays: [6, 7, 8] }, // days 0-2 unlabeled -> 'normal'
    },
    proposedLoad: { substationId: 'EVAL-06', sizeMW: PROPOSED_LOAD_MW, flexibilityAvailable: true },
  },
];

module.exports = {
  EVAL_CASES,
  buildProfile,
};
