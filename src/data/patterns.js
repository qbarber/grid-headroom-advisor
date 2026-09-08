'use strict';

/**
 * Named load-shape patterns for the synthetic scenario generator.
 *
 * Each pattern is a pure function of `(hourOfYear, ctx)` and returns a value in MW.
 * They are designed to be *composed* by the generator:
 *
 *   load = normalWeekdayWeekendPattern(h, ctx)   // baseline level + daily swing
 *        + hotSummerPeakPattern(h, ctx)          // additive surge, >= 0
 *        + mildDayPattern(h, ctx)                // additive relief, <= 0
 *
 * `ctx` is built once per hour by the generator and carries:
 *   {
 *     dayOfYear,        // 0..364
 *     hourOfDay,        // 0..23
 *     isWeekend,        // boolean
 *     ratedCapacityMW,  // substation rating
 *     isHotDay,         // this day is one of the hot-summer-peak days
 *     isMildDay,        // this day is one of the mild days
 *   }
 *
 * Everything here is a simple parameterized sine / cosine shape plus scalar
 * tuning constants. No real utility data.
 */

const HOURS_PER_DAY = 24;
const DAYS_PER_YEAR = 365;
const TWO_PI = Math.PI * 2;

/** Day of year (0..364) whose afternoon is the hottest — early/mid July. */
const PEAK_SUMMER_DAY = 193;

/**
 * Normalized daily load shape (dimensionless, roughly -1..+1).
 *
 * Two humps per day: a smaller morning shoulder and a larger late-afternoon /
 * early-evening peak, with an overnight trough. Built from the first two
 * harmonics of a sine wave.
 *
 * @param {number} hourOfDay 0..23
 * @returns {number} deviation shape, centred near 0
 */
function dailyShape(hourOfDay) {
  const phase = (hourOfDay / HOURS_PER_DAY) * TWO_PI;
  // Fundamental: peaks ~17:00, troughs ~05:00.
  const evening = Math.sin(phase - (5 / HOURS_PER_DAY) * TWO_PI);
  // Second harmonic: adds the morning shoulder around 08:00.
  const morning = 0.35 * Math.sin(2 * phase - (2 / HOURS_PER_DAY) * TWO_PI);
  return evening + morning;
}

/**
 * Seasonal multiplier on the baseline level. Summer-peaking (cooling-driven),
 * with a smaller winter bump for heating.
 *
 * @param {number} dayOfYear 0..364
 * @returns {number} additive seasonal deviation, in "fraction of rated" units
 */
function seasonalShape(dayOfYear) {
  const fromPeak = ((dayOfYear - PEAK_SUMMER_DAY) / DAYS_PER_YEAR) * TWO_PI;
  const summer = 0.08 * Math.cos(fromPeak); // +8% at mid-July, -8% at mid-January
  const winter = 0.03 * Math.cos(2 * fromPeak); // small secondary heating bump
  return summer + winter;
}

/**
 * Pattern 1 — Normal weekday / weekend pattern.
 *
 * A baseline daily curve on top of a seasonal trend. Weekdays sit higher and
 * swing harder than weekends.
 *
 * @param {number} _hourOfYear unused (kept for a uniform pattern signature)
 * @param {object} ctx
 * @returns {number} baseline load in MW (no noise)
 */
function normalWeekdayWeekendPattern(_hourOfYear, ctx) {
  const { dayOfYear, hourOfDay, isWeekend, ratedCapacityMW } = ctx;

  const baseFraction = isWeekend ? 0.51 : 0.58;
  const dailyAmpFraction = isWeekend ? 0.1 : 0.17;

  const level = baseFraction + seasonalShape(dayOfYear);
  const swing = dailyAmpFraction * dailyShape(hourOfDay);

  return (level + swing) * ratedCapacityMW;
}

/**
 * Pattern 2 — Hot-summer-peak pattern.
 *
 * On a handful of designated days (clustered in mid-July) an extra cooling load
 * surge appears in the afternoon, shaped as a sine bump that peaks around 16:00.
 * Zero on every other day and outside the afternoon window.
 *
 * @param {number} _hourOfYear unused
 * @param {object} ctx
 * @returns {number} additive surge in MW, always >= 0
 */
function hotSummerPeakPattern(_hourOfYear, ctx) {
  const { hourOfDay, ratedCapacityMW, isHotDay } = ctx;
  if (!isHotDay) return 0;

  const START_HOUR = 12;
  const END_HOUR = 20;
  if (hourOfDay < START_HOUR || hourOfDay > END_HOUR) return 0;

  // Half sine over the window, peaking at the midpoint (~16:00).
  const t = (hourOfDay - START_HOUR) / (END_HOUR - START_HOUR); // 0..1
  const bump = Math.sin(Math.PI * t);

  const peakSurgeFraction = 0.05; // up to +5% of rated at the worst hour
  return peakSurgeFraction * ratedCapacityMW * bump;
}

/**
 * Pattern 3 — Mild-day pattern.
 *
 * On designated cooler days demand is both lower and flatter: the baseline level
 * drops a little and the daily swing is damped. Returned as a negative
 * adjustment so it composes additively with the other patterns.
 *
 * @param {number} _hourOfYear unused
 * @param {object} ctx
 * @returns {number} additive adjustment in MW, always <= 0
 */
function mildDayPattern(_hourOfYear, ctx) {
  const { hourOfDay, isWeekend, ratedCapacityMW, isMildDay } = ctx;
  if (!isMildDay) return 0;

  const levelReliefFraction = 0.07; // ~7% of rated lower overall
  const flattenFraction = 0.45; // remove 45% of the day's above-average swing

  const dailyAmpFraction = isWeekend ? 0.1 : 0.17;
  const swing = dailyAmpFraction * dailyShape(hourOfDay);
  const positiveSwing = Math.max(swing, 0);

  return -(levelReliefFraction + flattenFraction * positiveSwing) * ratedCapacityMW;
}

module.exports = {
  PEAK_SUMMER_DAY,
  dailyShape,
  seasonalShape,
  normalWeekdayWeekendPattern,
  hotSummerPeakPattern,
  mildDayPattern,
};
