'use strict';

/**
 * Synthetic scenario generator.
 *
 * Produces a plausible year of hourly load for a fictional substation by
 * composing the three named patterns in ./patterns.js:
 *
 *   - normalWeekdayWeekendPattern  (baseline daily + seasonal shape)
 *   - hotSummerPeakPattern         (extreme mid-July afternoon surges)
 *   - mildDayPattern               (lower, flatter demand on cooler days)
 *
 * plus a small amount of random noise. Everything is generated in code — no real
 * utility data, no external calls.
 *
 * @typedef {Object} Substation
 * @property {string} id
 * @property {string} name
 * @property {number} ratedCapacityMW
 * @property {number[]} hourlyLoadProfile  8760 values, one per hour of a year
 */

const {
  PEAK_SUMMER_DAY,
  normalWeekdayWeekendPattern,
  hotSummerPeakPattern,
  mildDayPattern,
} = require('./patterns');

const HOURS_PER_DAY = 24;
const DAYS_PER_YEAR = 365;
const HOURS_PER_YEAR = HOURS_PER_DAY * DAYS_PER_YEAR; // 8760

// Reference year starts on a Wednesday (like 2025-01-01). Sunday = 0.
const YEAR_START_DOW = 3;

/**
 * mulberry32 — a tiny, fast, seedable PRNG. Returns a function producing floats
 * in [0, 1). Deterministic for a given seed so scenarios are reproducible.
 *
 * @param {number} seed
 * @returns {() => number}
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Approximate standard-normal sample via the sum of 3 uniforms (mean 0, sd ~1).
 *
 * @param {() => number} rng
 * @returns {number}
 */
function gaussish(rng) {
  return (rng() + rng() + rng() - 1.5) * 2;
}

/**
 * Pick `count` distinct day-of-year values within [minDay, maxDay].
 *
 * @param {() => number} rng
 * @param {number} count
 * @param {number} minDay
 * @param {number} maxDay
 * @returns {Set<number>}
 */
function pickDistinctDays(rng, count, minDay, maxDay) {
  const span = maxDay - minDay + 1;
  const days = new Set();
  let guard = 0;
  while (days.size < count && guard < count * 50) {
    days.add(minDay + Math.floor(rng() * span));
    guard += 1;
  }
  return days;
}

/**
 * Generate a synthetic substation with a full year of hourly load.
 *
 * @param {Object} [options]
 * @param {string} [options.id='SUB-001']
 * @param {string} [options.name='Synthetic Substation']
 * @param {number} [options.ratedCapacityMW=100]
 * @param {number} [options.seed=42]  fixed seed => reproducible profile
 * @returns {Substation}
 */
function generateSubstation(options = {}) {
  const {
    id = 'SUB-001',
    name = 'Synthetic Substation',
    ratedCapacityMW = 100,
    seed = 42,
  } = options;

  if (!(ratedCapacityMW > 0)) {
    throw new Error('ratedCapacityMW must be a positive number');
  }

  const rng = mulberry32(seed);

  // A handful of extreme days clustered around the summer peak (mid-July).
  const hotDays = pickDistinctDays(rng, 5, PEAK_SUMMER_DAY - 8, PEAK_SUMMER_DAY + 8);
  // Cooler "mild" days scattered across the shoulder seasons and beyond.
  const mildDays = pickDistinctDays(rng, 45, 0, DAYS_PER_YEAR - 1);
  // A hot day is never also a mild day.
  for (const d of hotDays) mildDays.delete(d);

  const hourlyLoadProfile = new Array(HOURS_PER_YEAR);

  for (let h = 0; h < HOURS_PER_YEAR; h += 1) {
    const dayOfYear = Math.floor(h / HOURS_PER_DAY);
    const hourOfDay = h % HOURS_PER_DAY;
    const dayOfWeek = (YEAR_START_DOW + dayOfYear) % 7;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const ctx = {
      dayOfYear,
      hourOfDay,
      isWeekend,
      ratedCapacityMW,
      isHotDay: hotDays.has(dayOfYear),
      isMildDay: mildDays.has(dayOfYear),
    };

    let load = normalWeekdayWeekendPattern(h, ctx);
    load += hotSummerPeakPattern(h, ctx);
    load += mildDayPattern(h, ctx);
    load += gaussish(rng) * (0.015 * ratedCapacityMW); // ~1.5% of rated sd

    if (load < 0) load = 0;
    hourlyLoadProfile[h] = Math.round(load * 1000) / 1000;
  }

  return { id, name, ratedCapacityMW, hourlyLoadProfile };
}

module.exports = {
  HOURS_PER_YEAR,
  mulberry32,
  generateSubstation,
};
