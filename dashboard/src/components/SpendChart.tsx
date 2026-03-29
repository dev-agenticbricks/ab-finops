import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const PLATFORM_COLORS: Record<string, string> = {
  GCP: '#60a5fa',
  Claude: '#a78bfa',
  Vercel: '#34d399',
  GoDaddy: '#fbbf24',
  Workspace: '#fb7185',
};

interface SpendChartProps {
  data: { date: string; [platform: string]: string | number }[];
  platforms: string[];
}

export function SpendChart({ data, platforms }: SpendChartProps) {
  return (
    <figure className="bg-slate-800 rounded-lg p-4">
      <h3 className="text-sm text-slate-400 uppercase tracking-wide mb-3">Daily Spend</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
            tickFormatter={(v) => `$${v}`} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 6 }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {platforms.map(p => (
            <Bar key={p} dataKey={p} stackId="a" fill={PLATFORM_COLORS[p] ?? '#6366f1'} radius={[2, 2, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
