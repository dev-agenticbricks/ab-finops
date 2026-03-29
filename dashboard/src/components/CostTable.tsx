import { useState } from 'react';
import type { CostRecord } from '../types';

const PLATFORMS = ['All', 'GCP', 'Claude', 'Vercel', 'GoDaddy', 'Workspace'];

interface CostTableProps {
  records: CostRecord[];
}

export function CostTable({ records }: CostTableProps) {
  const [platform, setPlatform] = useState('All');

  const filtered = platform === 'All' ? records : records.filter(r => r.platform === platform);

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs text-slate-400 uppercase tracking-wide">Top Resources</h3>
        <select
          value={platform}
          onChange={e => setPlatform(e.target.value)}
          className="text-xs bg-slate-700 text-slate-200 rounded px-2 py-1 border border-slate-600"
        >
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-slate-500 text-sm">No data for the selected period.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-700">
              <th className="text-left py-2">Date</th>
              <th className="text-left py-2">Platform</th>
              <th className="text-left py-2">Resource</th>
              <th className="text-right py-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="py-2 text-slate-400">{r.date}</td>
                <td className="py-2 text-slate-300">{r.platform}</td>
                <td className="py-2 text-slate-200">{r.resource}</td>
                <td className="py-2 text-right text-slate-100 font-mono">
                  ${r.cost_usd.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
