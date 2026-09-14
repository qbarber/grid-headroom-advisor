'use strict';

/**
 * Eval harness (Phase 5).
 *
 *   node scripts/runEval.js
 *
 * Runs the full pipeline — simulateEnvelope -> decideRecommendation ->
 * explainRecommendation — against the 6 hand-crafted cases in
 * src/eval/testCases.js, each with a hand-verified expected recommendation.
 * Prints a per-case result table, cross-checks the hand-counted exceeding-hour
 * total against what the simulator actually produced (catches a bad profile
 * before it can hide behind a lucky recommendation match), and prints an
 * overall accuracy summary. For any recommendation mismatch, prints the full
 * reasoningTrace to debug why. Console/JSON only — this produces the accuracy
 * number for the README, not a UI.
 */

const { simulateEnvelope } = require('../src/simulation/envelopeSimulator');
const { decideRecommendation } = require('../src/agent/decisionEngine');
const { explainRecommendation } = require('../src/agent/explainability');
const { EVAL_CASES } = require('../src/eval/testCases');

const results = EVAL_CASES.map((testCase, index) => {
  const { substation, proposedLoad, expectedRecommendation, expectedHoursExceedingCapacity } =
    testCase;

  const envelopeResult = simulateEnvelope(substation, proposedLoad);
  const decided = decideRecommendation(envelopeResult);
  const explained = explainRecommendation(decided, {
    ratedCapacityMW: substation.ratedCapacityMW,
    scenarioDays: substation.scenarioDays,
  });

  return {
    index: index + 1,
    label: testCase.label,
    rationale: testCase.rationale,
    expectedRecommendation,
    actualRecommendation: explained.recommendation,
    recommendationMatch: explained.recommendation === expectedRecommendation,
    expectedHoursExceedingCapacity,
    actualHoursExceedingCapacity: envelopeResult.hoursExceedingCapacity,
    hoursMatch: envelopeResult.hoursExceedingCapacity === expectedHoursExceedingCapacity,
    curtailmentPercent: envelopeResult.curtailmentPercent,
    drivingScenarios: envelopeResult.drivingScenarios,
    reasoningTrace: explained.reasoningTrace,
  };
});

console.log('=== Eval cases ===');
for (const r of results) {
  console.log(`\n${r.label}`);
  console.log(`  ${r.rationale}`);
}

console.log('\n=== Results ===\n');
const header = ['Case', 'Expected', 'Actual', 'Match', 'Hours (exp/actual)'];
console.log(
  `${header[0].padEnd(5)}${header[1].padEnd(18)}${header[2].padEnd(18)}${header[3].padEnd(7)}${header[4]}`,
);
console.log('-'.repeat(70));
for (const r of results) {
  const hoursCell = `${r.expectedHoursExceedingCapacity}/${r.actualHoursExceedingCapacity}${
    r.hoursMatch ? '' : '  <-- MISMATCH, check testCases.js construction'
  }`;
  console.log(
    `${String(r.index).padEnd(5)}${r.expectedRecommendation.padEnd(18)}` +
      `${r.actualRecommendation.padEnd(18)}${(r.recommendationMatch ? 'yes' : 'NO').padEnd(7)}${hoursCell}`,
  );
}

const correct = results.filter((r) => r.recommendationMatch).length;
const total = results.length;
const accuracyPercent = Math.round((correct / total) * 1000) / 10;

console.log('\n--- accuracy ---');
console.log(`${correct}/${total} correct (${accuracyPercent}%)`);

const hourMismatches = results.filter((r) => !r.hoursMatch);
if (hourMismatches.length > 0) {
  console.log('\n--- hour-count mismatches (test construction bug, not a decision error) ---');
  for (const r of hourMismatches) {
    console.log(
      `Case ${r.index} (${r.label}): expected ${r.expectedHoursExceedingCapacity} hours, ` +
        `simulator produced ${r.actualHoursExceedingCapacity}`,
    );
  }
}

const recommendationMismatches = results.filter((r) => !r.recommendationMatch);
if (recommendationMismatches.length > 0) {
  console.log('\n--- recommendation mismatches: full reasoningTrace ---');
  for (const r of recommendationMismatches) {
    console.log(`\nCase ${r.index} (${r.label}):`);
    console.log(`  expected: ${r.expectedRecommendation}, actual: ${r.actualRecommendation}`);
    console.log(`  curtailmentPercent: ${r.curtailmentPercent}%`);
    console.log(`  drivingScenarios: [${r.drivingScenarios.join(', ')}]`);
    console.log('  reasoningTrace:');
    for (const line of r.reasoningTrace) console.log(`    ${line}`);
  }
}
