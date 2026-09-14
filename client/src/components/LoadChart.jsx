import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

// Mirrors the non-leap reference-year convention the backend explanation text
// uses (see src/agent/explainability.js's MONTH_NAMES/MONTH_DAYS) -- only
// needed here to label the x-axis by month instead of raw day-of-year numbers.
const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_START_DAYS = MONTH_DAYS.reduce((acc, len, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + MONTH_DAYS[i - 1]);
  return acc;
}, []);

function monthLabel(day) {
  let month = 0;
  for (let i = MONTH_START_DAYS.length - 1; i >= 0; i -= 1) {
    if (day >= MONTH_START_DAYS[i]) {
      month = i;
      break;
    }
  }
  return MONTH_ABBR[month];
}

const round2 = (x) => Math.round(x * 100) / 100;

/**
 * Rendering simplification only: 8760 raw hourly points are too dense to plot
 * legibly, so the chart aggregates to one point per day (365 points) — daily
 * max and mean of the combined (baseline + proposed) load. The underlying
 * exceedance count / curtailment% from the API still comes from all 8760
 * hours; nothing about that calculation changes here.
 *
 * `underCap` / `overCap` split each day's max into the portion below and
 * above ratedCapacityMW so they can be stacked as two differently-colored
 * Area segments — the red band is exactly how far that day's peak breached
 * the rating.
 */
function aggregateDaily(hourlyLoadProfile, proposedLoadMW, ratedCapacityMW) {
  const points = [];
  for (let day = 0; day * 24 < hourlyLoadProfile.length; day += 1) {
    const hours = hourlyLoadProfile
      .slice(day * 24, day * 24 + 24)
      .map((mw) => mw + proposedLoadMW);
    if (hours.length === 0) continue;

    const max = Math.max(...hours);
    const mean = hours.reduce((sum, v) => sum + v, 0) / hours.length;

    points.push({
      day,
      mean: round2(mean),
      max: round2(max),
      underCap: round2(Math.min(max, ratedCapacityMW)),
      overCap: round2(Math.max(max - ratedCapacityMW, 0)),
    });
  }
  return points;
}

export default function LoadChart({ envelope }) {
  const { hourlyLoadProfile, proposedLoadMW, ratedCapacityMW } = envelope;
  const data = aggregateDaily(hourlyLoadProfile, proposedLoadMW, ratedCapacityMW);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">
        Combined load — daily max &amp; mean ({proposedLoadMW} MW proposed load included)
      </h2>
      <p className="mb-3 text-xs text-slate-400">
        365 points (one per day); the red band is each day&apos;s peak hour above the
        rated capacity line. Exceedance counts elsewhere on this page use all 8760
        hours, not this chart&apos;s daily aggregate.
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="day"
            ticks={MONTH_START_DAYS}
            tickFormatter={monthLabel}
            stroke="#64748b"
            fontSize={12}
          />
          <YAxis
            stroke="#64748b"
            fontSize={12}
            label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#64748b' }}
          />
          <Tooltip
            labelFormatter={(day) => `Day ${day} (${monthLabel(day)})`}
            formatter={(value, name) => [`${value} MW`, name]}
          />
          <Legend />
          <ReferenceLine
            y={ratedCapacityMW}
            stroke="#dc2626"
            strokeDasharray="4 4"
            label={{
              value: `Rated capacity (${ratedCapacityMW} MW)`,
              position: 'insideTopLeft',
              fill: '#dc2626',
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="underCap"
            stackId="dailyMax"
            name="Daily max (under cap)"
            stroke="#2563eb"
            fill="#93c5fd"
          />
          <Area
            type="monotone"
            dataKey="overCap"
            stackId="dailyMax"
            name="Daily max (over cap)"
            stroke="#dc2626"
            fill="#fca5a5"
          />
          <Line
            type="monotone"
            dataKey="mean"
            name="Daily mean"
            stroke="#334155"
            strokeWidth={1}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
