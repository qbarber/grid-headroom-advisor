'use strict';

/**
 * Sanity-check script for the envelope simulator (Phase 2).
 *
 *   node scripts/simulateSample.js
 *
 * Uses the same seeded 100 MW substation as Phase 1 and runs the simulator
 * against three proposed loads — one that should fit, one that should need some
 * curtailment, one that should need a lot — printing the full result object plus
 * a one-line summary for each. No UI, no decision logic.
 */

const { generateSubstation } = require('../src/data/generator');
const { simulateEnvelope } = require('../src/simulation/envelopeSimulator');

const substation = generateSubstation({
  id: 'SUB-001',
  name: 'Test Substation',
  ratedCapacityMW: 100,
  seed: 42,
});

const cases = [
  { label: 'small', sizeMW: 5, flexibilityAvailable: true },
  { label: 'medium', sizeMW: 15, flexibilityAvailable: true },
  { label: 'large', sizeMW: 40, flexibilityAvailable: true },
];

/**
 * Collapse a list of {day, hour} into a compact human string, merging runs of
 * consecutive hours on the same day: "day 195, hours 13-16; day 194, hour 15".
 */
function describeHours(hours) {
  if (hours.length === 0) return '(none)';

  const byDay = new Map();
  for (const { day, hour } of hours) {
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(hour);
  }

  const parts = [];
  for (const [day, dayHours] of byDay) {
    const sorted = [...dayHours].sort((a, b) => a - b);
    const runs = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i] === prev + 1) {
        prev = sorted[i];
        continue;
      }
      runs.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = sorted[i];
      prev = sorted[i];
    }
    runs.push(start === prev ? `${start}` : `${start}-${prev}`);
    const label = runs.length === 1 && !runs[0].includes('-') ? 'hour' : 'hours';
    parts.push(`day ${day}, ${label} ${runs.join(', ')}`);
  }
  return parts.join('; ');
}

const summaries = [];

for (const testCase of cases) {
  const proposedLoad = {
    substationId: substation.id,
    sizeMW: testCase.sizeMW,
    flexibilityAvailable: testCase.flexibilityAvailable,
  };

  const result = simulateEnvelope(substation, proposedLoad);

  console.log(`\n=== ${testCase.sizeMW} MW proposed load (${testCase.label}) ===`);
  console.log(JSON.stringify(result, null, 2));
  console.log(`most responsible: ${describeHours(result.topConstrainedHours)}`);

  const scenarios =
    result.drivingScenarios.length > 0 ? result.drivingScenarios.join('/') : 'none';
  summaries.push(
    `${testCase.sizeMW} MW: ${result.curtailmentPercent}% curtailment needed ` +
      `(${result.hoursExceedingCapacity} hrs, scenarios: ${scenarios})`,
  );
}

console.log('\n--- summary ---');
for (const line of summaries) console.log(line);
