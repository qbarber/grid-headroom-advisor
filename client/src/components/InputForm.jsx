import { useState } from 'react';

const DEFAULT_RATED_CAPACITY_MW = 100;
const DEFAULT_PROPOSED_LOAD_MW = 15;

export default function InputForm({ onCalculate, loading }) {
  const [ratedCapacityMW, setRatedCapacityMW] = useState(DEFAULT_RATED_CAPACITY_MW);
  const [proposedLoadMW, setProposedLoadMW] = useState(DEFAULT_PROPOSED_LOAD_MW);

  function handleSubmit(e) {
    e.preventDefault();
    onCalculate({
      ratedCapacityMW: Number(ratedCapacityMW),
      proposedLoadMW: Number(proposedLoadMW),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Rated capacity (MW)</span>
          <input
            type="number"
            min="1"
            step="1"
            value={ratedCapacityMW}
            onChange={(e) => setRatedCapacityMW(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            Proposed load: {proposedLoadMW} MW
          </span>
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={proposedLoadMW}
            onChange={(e) => setProposedLoadMW(e.target.value)}
            className="mt-3 w-full"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Calculating…' : 'Calculate'}
        </button>
      </div>
    </form>
  );
}
