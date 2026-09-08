'use strict';

/**
 * Sanity-check script for the synthetic scenario generator.
 *
 *   node scripts/generateSample.js
 *
 * Generates one sample substation (rated 100 MW) and prints summary statistics
 * so the generated year can be eyeballed for plausibility. No UI, no server.
 */

const { generateSubstation, HOURS_PER_YEAR } = require('../src/data/generator');

const HOURS_PER_DAY = 24;

const substation = generateSubstation({
  id: 'SUB-001',
  name: 'Test Substation',
  ratedCapacityMW: 100,
  seed: 42,
});

const { ratedCapacityMW, hourlyLoadProfile } = substation;
const n = hourlyLoadProfile.length;

let min = Infinity;
let max = -Infinity;
let sum = 0;
let peakHour = 0;
let over80 = 0;
let over100 = 0;

const threshold80 = 0.8 * ratedCapacityMW;

for (let h = 0; h < n; h += 1) {
  const v = hourlyLoadProfile[h];
  sum += v;
  if (v < min) min = v;
  if (v > max) {
    max = v;
    peakHour = h;
  }
  if (v >= threshold80) over80 += 1;
  if (v >= ratedCapacityMW) over100 += 1;
}

const mean = sum / n;
const pct = (count) => ((count / n) * 100).toFixed(2);
const mw = (x) => x.toFixed(2);

const peakDay = Math.floor(peakHour / HOURS_PER_DAY);
const peakHourOfDay = peakHour % HOURS_PER_DAY;

// Load factor: how "peaky" the year is (mean load / peak load). Closer to 1 = flat.
const loadFactor = mean / max;
// Utilization factor: how hard the substation is worked at its worst hour.
const utilizationFactor = max / ratedCapacityMW;

console.log(`Substation:        ${substation.name} (${substation.id})`);
console.log(`Rated capacity:    ${mw(ratedCapacityMW)} MW`);
console.log(`Hours generated:   ${n}${n === HOURS_PER_YEAR ? ' (OK)' : ' (EXPECTED 8760)'}`);
console.log('');
console.log(`Min hourly load:   ${mw(min)} MW`);
console.log(`Max hourly load:   ${mw(max)} MW  (day ${peakDay}, hour ${peakHourOfDay})`);
console.log(`Mean hourly load:  ${mw(mean)} MW  (${(mean / ratedCapacityMW * 100).toFixed(2)}% of rated)`);
console.log('');
console.log(`Hours >= 80% (${mw(threshold80)} MW): ${over80}  (${pct(over80)}% of year)`);
console.log(`Hours >= 100% (${mw(ratedCapacityMW)} MW): ${over100}  (${pct(over100)}% of year)`);
console.log('');
console.log(`Load factor:         ${loadFactor.toFixed(3)}  (mean ${mw(mean)} MW / peak ${mw(max)} MW)`);
console.log(`Utilization factor:  ${utilizationFactor.toFixed(3)}  (peak ${mw(max)} MW / rated ${mw(ratedCapacityMW)} MW)`);
