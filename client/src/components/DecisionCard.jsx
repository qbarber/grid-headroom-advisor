const RECOMMENDATION_STYLES = {
  connect_now: {
    label: 'Connect now',
    badge: 'border-emerald-300 bg-emerald-100 text-emerald-800',
  },
  flex_connect: {
    label: 'Flex connect',
    badge: 'border-amber-300 bg-amber-100 text-amber-800',
  },
  flag_for_review: {
    label: 'Flag for review',
    badge: 'border-red-300 bg-red-100 text-red-800',
  },
};

export default function DecisionCard({ envelope }) {
  const {
    recommendation,
    explanation,
    drivingScenarioSummary,
    tradeoff,
    curtailmentPercent,
    hoursExceedingCapacity,
  } = envelope;

  const style = RECOMMENDATION_STYLES[recommendation] || RECOMMENDATION_STYLES.flag_for_review;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <span
          className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold ${style.badge}`}
        >
          {style.label}
        </span>
        <p className="mt-2 text-xs text-slate-500">
          {hoursExceedingCapacity} hours/year exceed capacity ({curtailmentPercent}%)
        </p>
      </div>

      <p className="text-sm leading-relaxed text-slate-700">{explanation}</p>

      <div className="border-t border-slate-100 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Driving scenarios
        </h3>
        <p className="mt-1 text-sm text-slate-700">{drivingScenarioSummary}</p>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tradeoff</h3>
        <dl className="mt-1 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-slate-400">Years faster</dt>
            <dd className="font-medium text-slate-800">
              {tradeoff.yearsFaster === null
                ? 'Not applicable at this severity'
                : `${tradeoff.yearsFaster} years`}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Curtailment cost</dt>
            <dd className="font-medium capitalize text-slate-800">
              {tradeoff.curtailmentCostEstimate}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
