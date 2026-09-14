'use strict';

/**
 * Explainability layer (Phase 4).
 *
 * Given the full OperatingEnvelope from Phase 3 (decisionEngine.js) — which
 * already carries `recommendation` and `reasoningTrace` — render it into
 * plain-English text. This adds narration only: it reads fields Phase 2/3
 * already computed (`hoursExceedingCapacity`, `curtailmentPercent`,
 * `drivingScenarios`, `topConstrainedHours`, `recommendation`) and does not run
 * any new simulation or change the recommendation.
 *
 * @typedef {import('./decisionEngine').OperatingEnvelope} OperatingEnvelope
 *
 * @typedef {Object} Tradeoff
 * @property {number | null} yearsFaster  0 for connect_now; 3.5 (industry-reported 3-5yr
 *                                        midpoint) for flex_connect and the narrower
 *                                        flag_for_review cases (drivingScenarios.length
 *                                        < 3, i.e. flagged only for curtailment% above
 *                                        the threshold — flex-connect is still coherent);
 *                                        null when drivingScenarios.length === 3, since
 *                                        breaches that broad aren't a narrow peak-shaving
 *                                        problem the flex-connect timeline applies to.
 * @property {string} curtailmentCostEstimate  'negligible' | 'minor' | 'moderate'
 *
 * @typedef {OperatingEnvelope & {
 *   explanation: string,
 *   drivingScenarioSummary: string,
 *   tradeoff: Tradeoff,
 * }} ExplainedOperatingEnvelope
 */

const { scenarioForDay } = require('../simulation/envelopeSimulator');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const SCENARIO_LABELS = {
  normal: 'normal weekday/weekend',
  'hot-summer-peak': 'hot-summer-peak afternoon',
  'mild-day': 'mild-day',
};

// Canonical, readable order for listing scenario types together — independent of
// drivingScenarios' worst-first (by hour count) ordering.
const SCENARIO_CANONICAL_ORDER = ['normal', 'hot-summer-peak', 'mild-day'];

const MINOR_CURTAILMENT_THRESHOLD_PERCENT = 0.5;
// Matches decisionEngine's flex_connect cutoff — above this is flag_for_review territory.
const MODERATE_CURTAILMENT_THRESHOLD_PERCENT = 1.0;

const FLEX_TIMELINE_YEARS_FASTER = 3.5;
const FLEX_TIMELINE_CITATION =
  'industry reporting that flexible connections come online 3-5 years sooner than inflexible ones';

/**
 * Convert a 0-indexed day-of-year (0..364, non-leap reference year) into
 * {month, dayOfMonth}.
 *
 * @param {number} day
 * @returns {{ month: number, dayOfMonth: number }}
 */
function dateForDayOfYear(day) {
  let remaining = day;
  for (let m = 0; m < MONTH_DAYS.length; m += 1) {
    if (remaining < MONTH_DAYS[m]) return { month: m, dayOfMonth: remaining + 1 };
    remaining -= MONTH_DAYS[m];
  }
  return { month: 11, dayOfMonth: 31 };
}

/** Roughly describe a day of year as e.g. "mid-July". */
function roughlyWhen(day) {
  const { month, dayOfMonth } = dateForDayOfYear(day);
  const frac = (dayOfMonth - 1) / MONTH_DAYS[month];
  const part = frac < 1 / 3 ? 'early' : frac < 2 / 3 ? 'mid' : 'late';
  return `${part}-${MONTH_NAMES[month]}`;
}

/** Merge a list of hour-of-day numbers into compact run labels, e.g. "13-16, 20". */
function hourRunsLabel(hours) {
  const sorted = [...hours].sort((a, b) => a - b);
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
  const noun = runs.length === 1 && !runs[0].includes('-') ? 'hour' : 'hours';
  return `${noun} ${runs.join(', ')}`;
}

function scenarioLabel(scenario) {
  return SCENARIO_LABELS[scenario] || scenario;
}

/**
 * One-sentence summary of which scenario type(s) are driving the breach, and
 * why that composition matters — this is the same "how many scenario types"
 * signal decisionEngine's rule 2 checks (`drivingScenarios.length === 3`).
 *
 * @param {string[]} drivingScenarios
 * @returns {string}
 */
function summarizeDrivingScenarios(drivingScenarios) {
  if (drivingScenarios.length === 0) {
    return 'No hours exceed capacity, so no scenario type is driving risk.';
  }

  const present = SCENARIO_CANONICAL_ORDER.filter((s) => drivingScenarios.includes(s));

  if (present.length === 1) {
    return `Breaches are concentrated in ${present[0]} hours only.`;
  }

  if (present.length === 2) {
    return (
      `Breaches occur in ${present[0]} and ${present[1]} hours — spread beyond a ` +
      'single peak scenario, but not yet broad-based across all scenario types.'
    );
  }

  return (
    `Breaches span ${present[0]}, ${present[1]}, and ${present[2]} hours, ` +
    'indicating broad rather than peak-only stress.'
  );
}

/**
 * Qualitative curtailment-cost label. Not a dollar figure — this project
 * doesn't model a load's revenue-per-hour, so cost is bucketed instead.
 *
 * @param {number} curtailmentPercent
 * @returns {'negligible' | 'minor' | 'moderate'}
 */
function estimateCurtailmentCost(curtailmentPercent) {
  if (curtailmentPercent < MINOR_CURTAILMENT_THRESHOLD_PERCENT) return 'negligible';
  if (curtailmentPercent <= MODERATE_CURTAILMENT_THRESHOLD_PERCENT) return 'minor';
  return 'moderate';
}

/**
 * @param {import('../simulation/envelopeSimulator').PartialOperatingEnvelope['topConstrainedHours']} topConstrainedHours
 * @returns {{ day: number, hoursLabel: string } | null}
 */
function worstDayCluster(topConstrainedHours) {
  if (topConstrainedHours.length === 0) return null;
  const worstDay = topConstrainedHours[0].day;
  const hoursOnWorstDay = topConstrainedHours
    .filter((h) => h.day === worstDay)
    .map((h) => h.hour);
  return { day: worstDay, hoursLabel: hourRunsLabel(hoursOnWorstDay) };
}

/**
 * Build the plain-English explanation paragraph.
 *
 * @param {OperatingEnvelope} envelope
 * @param {number} [ratedCapacityMW]  when known, lets the text cite the actual
 *                                    rating (e.g. "100 MW rating") instead of a
 *                                    generic phrase.
 * @param {{ hotDays: number[], mildDays: number[] }} [scenarioDays]  when known,
 *                                    classifies the worst-hour cluster's actual
 *                                    day rather than falling back to the overall
 *                                    most-common scenario type.
 * @returns {string}
 */
function buildExplanation(envelope, ratedCapacityMW, scenarioDays) {
  const {
    proposedLoadMW,
    hoursExceedingCapacity,
    curtailmentPercent,
    drivingScenarios,
    topConstrainedHours,
    recommendation,
  } = envelope;

  const ratingLabel = ratedCapacityMW ? `${ratedCapacityMW} MW rating` : 'rated capacity';
  const sentences = [];

  if (hoursExceedingCapacity === 0) {
    sentences.push(
      `This ${proposedLoadMW} MW proposed load would not exceed the substation's ` +
        `${ratingLabel} in any hour of the simulated year, so it can connect now with ` +
        'no curtailment required.',
    );
  } else {
    const cluster = worstDayCluster(topConstrainedHours);
    let clusterScenario = drivingScenarios[0]; // fallback if scenarioDays isn't supplied
    if (cluster && scenarioDays) {
      clusterScenario = scenarioForDay(
        cluster.day,
        new Set(scenarioDays.hotDays),
        new Set(scenarioDays.mildDays),
      );
    }
    const dominantScenario = clusterScenario ? scenarioLabel(clusterScenario) : 'unknown';

    // Match drivingScenarioSummary's framing: with all 3 scenario types present, calling
    // the breach "concentrated in <one type>" would contradict "broad rather than
    // peak-only stress" below — so this case gets a "broadly across the year" framing
    // instead, with the worst cluster demoted to "single most extreme case".
    const spansAllScenarioTypes = drivingScenarios.length === 3;

    let whereClause = '';
    if (cluster && spansAllScenarioTypes) {
      whereClause =
        '; breaches occur broadly across the year (not limited to a single scenario type), ' +
        `with ${roughlyWhen(cluster.day)} (day ${cluster.day}, ${cluster.hoursLabel}) as the ` +
        'single most extreme case';
    } else if (cluster) {
      whereClause =
        `, concentrated in ${dominantScenario} hours around ${roughlyWhen(cluster.day)} ` +
        `(day ${cluster.day}, ${cluster.hoursLabel})`;
    }

    sentences.push(
      `This substation would exceed its ${ratingLabel} for ${hoursExceedingCapacity} hours ` +
        `per year (${curtailmentPercent}%)${whereClause}.`,
    );

    if (recommendation === 'flex_connect') {
      sentences.push(
        'A curtailment schedule during these specific hours would allow the new load to ' +
          `connect without requiring new infrastructure, based on ${FLEX_TIMELINE_CITATION}.`,
      );
    } else if (spansAllScenarioTypes) {
      // Breaches this broad aren't a narrow peak-shaving problem, so the flex-connect
      // timeline advantage doesn't clearly apply here — see tradeoff.yearsFaster (null).
      sentences.push(
        'Because breaches span all three scenario types rather than a single peak ' +
          'scenario, this case is flagged for manual review rather than auto-approved as ' +
          'a flex-connect deal. At this severity, flex-connect economics don\'t clearly ' +
          'apply — a different site or a different power strategy is likely a better fit ' +
          'than curtailment at this substation.',
      );
    } else {
      sentences.push(
        `Because curtailment would be needed for ${curtailmentPercent}% of the year, above ` +
          `the ${MODERATE_CURTAILMENT_THRESHOLD_PERCENT}% flex-connect threshold, this case ` +
          'is flagged for manual review rather than auto-approved as a flex-connect deal; ' +
          `if a reviewer approves it, it could still see ${FLEX_TIMELINE_YEARS_FASTER} years ` +
          `sooner service based on ${FLEX_TIMELINE_CITATION}.`,
      );
    }

    sentences.push(
      `Actual curtailment cost depends on the load's specific revenue-per-hour, which this ` +
        `project doesn't model — here it is estimated only qualitatively as ` +
        `${estimateCurtailmentCost(curtailmentPercent)}.`,
    );
  }

  return sentences.join(' ');
}

/**
 * Add plain-English explanation, a driving-scenario summary, and a flex-connect
 * tradeoff estimate to a Phase 3 OperatingEnvelope. Adds text only — no new
 * simulation and no change to `recommendation` or `reasoningTrace`.
 *
 * @param {OperatingEnvelope} envelope
 * @param {Object} [options]
 * @param {number} [options.ratedCapacityMW]  substation rating, for richer text
 * @param {{ hotDays: number[], mildDays: number[] }} [options.scenarioDays]
 *        substation.scenarioDays, so the worst-hour cluster can be classified
 *        precisely instead of falling back to the overall dominant scenario.
 * @returns {ExplainedOperatingEnvelope}
 */
function explainRecommendation(envelope, options = {}) {
  const { ratedCapacityMW, scenarioDays } = options;
  const { recommendation, curtailmentPercent, drivingScenarios } = envelope;

  let yearsFaster;
  if (recommendation === 'connect_now') {
    yearsFaster = 0;
  } else if (drivingScenarios.length === 3) {
    // Breaches this broad aren't a coherent flex-connect deal — see buildExplanation.
    yearsFaster = null;
  } else {
    yearsFaster = FLEX_TIMELINE_YEARS_FASTER;
  }

  const tradeoff = {
    yearsFaster,
    curtailmentCostEstimate: estimateCurtailmentCost(curtailmentPercent),
  };

  return {
    ...envelope,
    explanation: buildExplanation(envelope, ratedCapacityMW, scenarioDays),
    drivingScenarioSummary: summarizeDrivingScenarios(drivingScenarios),
    tradeoff,
  };
}

module.exports = {
  explainRecommendation,
};
