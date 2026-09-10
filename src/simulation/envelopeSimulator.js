'use strict';

/**
 * Envelope simulator (Phase 2).
 *
 * Given a Substation (from generateSubstation()) and a ProposedLoad, work out
 * where the combined load would break the substation's rating, how much the new
 * load would have to curtail to stay within it, and which Phase 1 scenario(s) and
 * specific hours are driving the breach.
 *
 * This is the numeric core only. It produces a *partial* OperatingEnvelope — no
 * recommendation (Phase 3) and no plain-English explanation (Phase 4).
 *
 * @typedef {import('../data/generator').Substation} Substation
 *
 * @typedef {Object} ProposedLoad
 * @property {string}  substationId
 * @property {number}  sizeMW
 * @property {boolean} flexibilityAvailable   whether the load can shed/shift its
 *                                            draw. Recorded by callers but not
 *                                            used here — Phase 3's decision logic
 *                                            consumes it.
 *
 * @typedef {Object} ConstrainedHour
 * @property {number} day            day of year, 0..364
 * @property {number} hour           hour of day, 0..23
 * @property {number} combinedLoadMW substation load + proposed load, that hour
 *
 * @typedef {Object} PartialOperatingEnvelope
 * @property {string}            substationId
 * @property {number}            proposedLoadMW
 * @property {number}            hoursExceedingCapacity
 * @property {number}            curtailmentPercent   share of the year (0..100)
 *                                                    the new load would need to
 *                                                    curtail
 * @property {string[]}          drivingScenarios     'normal' | 'hot-summer-peak'
 *                                                    | 'mild-day', worst first
 * @property {ConstrainedHour[]} topConstrainedHours  up to 10, worst first
 */

const { HOURS_PER_YEAR } = require('../data/generator');

const HOURS_PER_DAY = 24;
const TOP_HOURS = 10;

/** Round to 3 decimals, matching the generator's hourlyLoadProfile precision. */
function round3(x) {
  return Math.round(x * 1000) / 1000;
}

/**
 * Classify a day of year against the substation's named Phase 1 scenarios.
 *
 * @param {number} day
 * @param {Set<number>} hotDays
 * @param {Set<number>} mildDays
 * @returns {'hot-summer-peak' | 'mild-day' | 'normal'}
 */
function scenarioForDay(day, hotDays, mildDays) {
  if (hotDays.has(day)) return 'hot-summer-peak';
  if (mildDays.has(day)) return 'mild-day';
  return 'normal';
}

/**
 * Simulate the operating envelope for a proposed load on a substation.
 *
 * @param {Substation} substation  from generateSubstation()
 * @param {ProposedLoad} proposedLoad
 * @returns {PartialOperatingEnvelope}
 */
function simulateEnvelope(substation, proposedLoad) {
  const { id, ratedCapacityMW, hourlyLoadProfile, scenarioDays } = substation;
  const { sizeMW } = proposedLoad;

  if (!scenarioDays) {
    throw new Error(
      'substation.scenarioDays is missing — regenerate it with generateSubstation()',
    );
  }
  if (!(sizeMW >= 0)) {
    throw new Error('proposedLoad.sizeMW must be a non-negative number');
  }

  const hotDays = new Set(scenarioDays.hotDays);
  const mildDays = new Set(scenarioDays.mildDays);

  // 1 + 2: add the proposed load to every hour, collect the hours that break the
  // rating. "Exceeds" is strict — combined load exactly at the rating is fine.
  const constrainedHours = [];
  const scenarioCounts = new Map(); // scenario -> count of constrained hours

  for (let h = 0; h < hourlyLoadProfile.length; h += 1) {
    const combined = hourlyLoadProfile[h] + sizeMW;
    if (combined <= ratedCapacityMW) continue;

    const day = Math.floor(h / HOURS_PER_DAY);
    const hour = h % HOURS_PER_DAY;
    const scenario = scenarioForDay(day, hotDays, mildDays);

    constrainedHours.push({ day, hour, combinedLoadMW: round3(combined) });
    scenarioCounts.set(scenario, (scenarioCounts.get(scenario) || 0) + 1);
  }

  const hoursExceedingCapacity = constrainedHours.length;

  // 3: the proposed load runs every hour, so every exceeding hour is one it would
  // have to reduce or skip. Curtailment level = that share of the whole year.
  const curtailmentPercent = round3(
    (hoursExceedingCapacity / HOURS_PER_YEAR) * 100,
  );

  // 4a: which named scenarios the constrained hours fall into, worst first.
  const drivingScenarios = [...scenarioCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([scenario]) => scenario);

  // 4b: the specific hours most responsible — highest combined load first.
  const topConstrainedHours = [...constrainedHours]
    .sort((a, b) => b.combinedLoadMW - a.combinedLoadMW)
    .slice(0, TOP_HOURS);

  return {
    substationId: id,
    proposedLoadMW: sizeMW,
    hoursExceedingCapacity,
    curtailmentPercent,
    drivingScenarios,
    topConstrainedHours,
  };
}

module.exports = {
  simulateEnvelope,
  scenarioForDay,
};
