export default function EvalPanel() {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      <span className="font-semibold text-slate-800">Eval harness:</span> 6/6 (100%) accuracy on
      6 hand-verified boundary test cases covering every decision branch —{' '}
      <code className="rounded bg-slate-200 px-1 py-0.5 text-xs">connect_now</code>,{' '}
      <code className="rounded bg-slate-200 px-1 py-0.5 text-xs">flex_connect</code>, and both{' '}
      <code className="rounded bg-slate-200 px-1 py-0.5 text-xs">flag_for_review</code> triggers
      independently and together. See{' '}
      <code className="rounded bg-slate-200 px-1 py-0.5 text-xs">src/eval/testCases.js</code> and
      run <code className="rounded bg-slate-200 px-1 py-0.5 text-xs">npm run eval</code> to
      reproduce.
    </div>
  );
}
