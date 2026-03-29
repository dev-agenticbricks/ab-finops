export interface CostRecord {
  date: string;
  platform: 'GCP' | 'Claude' | 'Vercel' | 'GoDaddy' | 'Workspace';
  project: string;
  resource: string;
  cost_usd: number;
  metadata: Record<string, unknown>;
}

export interface CostsData {
  generated_at: string;
  window_days: number;
  records: CostRecord[];
}

export type DateRange = 7 | 30 | 90;
