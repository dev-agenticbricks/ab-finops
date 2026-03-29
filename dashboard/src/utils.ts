import type { CostRecord, DateRange } from './types';

export function filterByDays(records: CostRecord[], days: DateRange): CostRecord[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return records.filter(r => r.date >= cutoffStr);
}

export function getTotalCost(records: CostRecord[]): number {
  return records.reduce((sum, r) => sum + r.cost_usd, 0);
}

export function sumCostsByPlatform(records: CostRecord[]): Record<string, number> {
  return records.reduce((acc, r) => {
    acc[r.platform] = (acc[r.platform] ?? 0) + r.cost_usd;
    return acc;
  }, {} as Record<string, number>);
}

export function getDailyTotals(records: CostRecord[]): { date: string; [platform: string]: string | number }[] {
  const byDate: Record<string, Record<string, number>> = {};
  for (const r of records) {
    if (!byDate[r.date]) byDate[r.date] = {};
    byDate[r.date][r.platform] = (byDate[r.date][r.platform] ?? 0) + r.cost_usd;
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, platforms]) => ({ date, ...platforms }));
}

export function getTopResources(records: CostRecord[], limit = 20): CostRecord[] {
  const byKey: Record<string, CostRecord> = {};
  for (const r of records) {
    const key = `${r.platform}::${r.resource}`;
    if (!byKey[key]) byKey[key] = { ...r, cost_usd: 0 };
    byKey[key].cost_usd += r.cost_usd;
  }
  return Object.values(byKey)
    .sort((a, b) => b.cost_usd - a.cost_usd)
    .slice(0, limit);
}
