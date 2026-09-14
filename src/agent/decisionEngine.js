'use strict';

/**
 * Agent decision logic (Phase 3).
 *
 * Given the numeric output of the Phase 2 envelope simulator, classify it into a
 * recommendation and record, step by step, which rule fired and why. No new
 * simulation happens here — this is a decision layer on top of Phase 2's output.
 *
 * @typedef {import('../simulation/envelopeSimulator').PartialOperatingEnvelope} PartialOperatingEnvelope
 *
 * @typedef {'connect_now' | 'flex_connect' | 'flag_for_review'} Recommendation
 *
 * @typedef {PartialOperatingEnvelope & {
 *   recommendation: Recommendation,
 *   reasoningTrace: string[],
 * }} OperatingEnvelope
 */

const CURTAILMENT_THRESHOLD_PERCENT = 1.0;
const SCENARIO_TYPE_LIMIT = 3;

/**
 * Decide a recommendation for a proposed load's operating envelope.
 *
 * Rules, checked in order:
 *   1. hoursExceedingCapacity === 0            -> connect_now
 *   2. curtailmentPercent <= 1.0%
 *      AND drivingScenarios.length < 3         -> flex_connect
 *   3. otherwise                                -> flag_for_review
 *
 * @param {PartialOperatingEnvelope} envelope
 * @returns {OperatingEnvelope}
 */
function decideRecommendation(envelope) {
  const { hoursExceedingCapacity, curtailmentPercent, drivingScenarios } = envelope;
  const reasoningTrace = [];
  let recommendation;

  if (hoursExceedingCapacity === 0) {
    reasoningTrace.push(`hoursExceedingCapacity ${hoursExceedingCapacity} === 0`);
    recommendation = 'connect_now';
  } else {
    reasoningTrace.push(`hoursExceedingCapacity ${hoursExceedingCapacity} > 0`);

    const withinCurtailmentThreshold = curtailmentPercent <= CURTAILMENT_THRESHOLD_PERCENT;
    reasoningTrace.push(
      `curtailmentPercent ${curtailmentPercent}% ${withinCurtailmentThreshold ? '<=' : '>'} ` +
        `${CURTAILMENT_THRESHOLD_PERCENT}% threshold`,
    );

    const scenarioCount = drivingScenarios.length;
    const underScenarioLimit = scenarioCount < SCENARIO_TYPE_LIMIT;
    reasoningTrace.push(
      `drivingScenarios: ${scenarioCount} of ${SCENARIO_TYPE_LIMIT} types present ` +
        `(${underScenarioLimit ? '<' : '=='} ${SCENARIO_TYPE_LIMIT})`,
    );

    recommendation =
      withinCurtailmentThreshold && underScenarioLimit ? 'flex_connect' : 'flag_for_review';
  }

  reasoningTrace.push(`-> ${recommendation}`);

  return { ...envelope, recommendation, reasoningTrace };
}

module.exports = {
  decideRecommendation,
};
