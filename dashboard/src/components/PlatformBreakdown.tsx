const PLATFORM_COLORS: Record<string, string> = {
  GCP: 'bg-blue-400',
  Claude: 'bg-violet-400',
  Vercel: 'bg-emerald-400',
  GoDaddy: 'bg-amber-400',
  Workspace: 'bg-rose-400',
};

interface PlatformBreakdownProps {
  costs: Record<string, number>;
}

export function PlatformBreakdown({ costs }: PlatformBreakdownProps) {
  const total = Object.values(costs).reduce((s, v) => s + v, 0);
  const entries = Object.entries(costs).sort(([, a], [, b]) => b - a);

  if (entries.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-xs text-slate-400 uppercase tracking-wide mb-3">By Platform</h3>
        <p className="text-slate-500 text-sm">No data</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <h3 className="text-xs text-slate-400 uppercase tracking-wide mb-3">By Platform</h3>
      <ul className="space-y-2">
        {entries.map(([platform, cost]) => {
          const pct = total > 0 ? Math.round((cost / total) * 100) : 0;
          const bar = PLATFORM_COLORS[platform] ?? 'bg-slate-400';
          return (
            <li key={platform}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-200">{platform}</span>
                <span className="text-slate-400">{pct}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div className={`${bar} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
