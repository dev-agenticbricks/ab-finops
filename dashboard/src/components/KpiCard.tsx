interface KpiCardProps {
  label: string;
  value: number;
  color?: string;
}

export function KpiCard({ label, value, color = 'text-slate-100' }: KpiCardProps) {
  const formatted = value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  return (
    <div className="bg-slate-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{formatted}</span>
    </div>
  );
}
