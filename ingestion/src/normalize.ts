import type { CostRecord, RawGcpRow } from './types';

export function normalizeGcpRow(raw: RawGcpRow): CostRecord {
  return {
    date: raw.date,
    platform: 'GCP',
    project: raw.project,
    resource: raw.resource ?? '',
    cost_usd: parseFloat(raw.cost_usd.toFixed(6)),
    metadata: {},
  };
}
