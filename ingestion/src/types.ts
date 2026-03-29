export interface CostRecord {
  date: string;          // "YYYY-MM-DD"
  platform: 'GCP' | 'Claude' | 'Vercel' | 'GoDaddy' | 'Workspace';
  project: string;
  resource: string;
  cost_usd: number;
  metadata: Record<string, unknown>;
}

/** Shape of a row returned by the GCP billing export BigQuery query */
export interface RawGcpRow {
  date: string;      // FORMAT_DATE returns plain string
  project: string;
  resource: string;
  cost_usd: number;
}
