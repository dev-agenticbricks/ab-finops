import { useState } from 'react';
import type { DateRange, CostsData } from './types';
import { filterByDays, getTotalCost, sumCostsByPlatform, getDailyTotals, getTopResources } from './utils';
import { KpiCard } from './components/KpiCard';
import { SpendChart } from './components/SpendChart';
import { PlatformBreakdown } from './components/PlatformBreakdown';
import { CostTable } from './components/CostTable';
import costsData from '../data/costs.json';

const data = costsData as CostsData;

const PLATFORM_COLORS: Record<string, string> = {
  GCP: 'text-blue-400',
  Claude: 'text-violet-400',
  Vercel: 'text-emerald-400',
  GoDaddy: 'text-amber-400',
  Workspace: 'text-rose-400',
};

export default function App() {
  const [range, setRange] = useState<DateRange>(30);

  const filtered = filterByDays(data.records, range);
  const total = getTotalCost(filtered);
  const byPlatform = sumCostsByPlatform(filtered);
  const dailyTotals = getDailyTotals(filtered);
  const platforms = [...new Set(filtered.map(r => r.platform))];
  const topResources = getTopResources(filtered);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Agenticbricks FinOps</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Last updated: {new Date(data.generated_at).toLocaleString()}
          </p>
        </div>
        <select
          value={range}
          onChange={e => setRange(Number(e.target.value) as DateRange)}
          className="bg-slate-800 text-slate-200 text-sm rounded px-3 py-1.5 border border-slate-600"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Total" value={total} />
        {Object.entries(byPlatform).map(([p, cost]) => (
          <KpiCard key={p} label={p} value={cost} color={PLATFORM_COLORS[p]} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <SpendChart data={dailyTotals} platforms={platforms} />
        </div>
        <PlatformBreakdown costs={byPlatform} />
      </div>

      {/* Table */}
      <CostTable records={topResources} />
    </div>
  );
}
