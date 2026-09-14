'use strict';

/**
 * Sanity-check script for the agent decision layer (Phase 3).
 *
 *   node scripts/decideSample.js
 *
 * Uses the same seeded 100 MW substation as Phase 1/2 and runs the simulator +
 * decision engine against four proposed loads — the 5/15/40 MW cases from
 * scripts/simulateSample.js, plus a 20 MW case added to probe the 1%
 * curtailment boundary. Prints the recommendation and reasoningTrace for each.
 * Console/JSON only — no plain-English explanation (that's Phase 4).
 */

const { generateSubstation } = require('../src/data/generator');
const { simulateEnvelope } = require('../src/simulation/envelopeSimulator');
const { decideRecommendation } = require('../src/agent/decisionEngine');

const substation = generateSubstation({
  id: 'SUB-001',
  name: 'Test Substation',
  ratedCapacityMW: 100,
  seed: 42,
});

const cases = [
  { label: 'small', sizeMW: 5, flexibilityAvailable: true },
  { label: 'medium', sizeMW: 15, flexibilityAvailable: true },
  { label: 'boundary', sizeMW: 20, flexibilityAvailable: true },
  { label: 'large', sizeMW: 40, flexibilityAvailable: true },
];

const summaries = [];

for (const testCase of cases) {
  const proposedLoad = {
    substationId: substation.id,
    sizeMW: testCase.sizeMW,
    flexibilityAvailable: testCase.flexibilityAvailable,
  };

  const envelopeResult = simulateEnvelope(substation, proposedLoad);
  const decided = decideRecommendation(envelopeResult);

  console.log(`\n=== ${testCase.sizeMW} MW proposed load (${testCase.label}) ===`);
  console.log(`recommendation: ${decided.recommendation}`);
  console.log('reasoningTrace:');
  for (const line of decided.reasoningTrace) console.log(`  ${line}`);

  if (testCase.label === 'boundary') {
    console.log(
      `\n20 MW boundary check: landed on "${decided.recommendation}" ` +
        `(curtailmentPercent=${decided.curtailmentPercent}%, ` +
        `drivingScenarios=[${decided.drivingScenarios.join(', ')}])`,
    );
  }

  summaries.push(`${testCase.sizeMW} MW: ${decided.recommendation}`);
}

console.log('\n--- summary ---');
for (const line of summaries) console.log(line);
