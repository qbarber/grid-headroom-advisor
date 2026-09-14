import { useState } from 'react';
import InputForm from './components/InputForm.jsx';
import LoadChart from './components/LoadChart.jsx';
import DecisionCard from './components/DecisionCard.jsx';
import EvalPanel from './components/EvalPanel.jsx';

export default function App() {
  const [envelope, setEnvelope] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleCalculate({ ratedCapacityMW, proposedLoadMW }) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/envelope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratedCapacityMW, proposedLoadMW }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setEnvelope(data);
    } catch (err) {
      setError(err.message);
      setEnvelope(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <header>
          <h1 className="text-2xl font-semibold">Grid Headroom Advisor</h1>
          <p className="text-sm text-slate-500">
            Evaluate spare substation capacity for a proposed new load.
          </p>
        </header>

        <InputForm onCalculate={handleCalculate} loading={loading} />

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {envelope && (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <LoadChart envelope={envelope} />
            </div>
            <div className="lg:col-span-2">
              <DecisionCard envelope={envelope} />
            </div>
          </div>
        )}

        <EvalPanel />
      </div>
    </div>
  );
}
