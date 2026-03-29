import { BigQuery } from '@google-cloud/bigquery';
import { normalizeGcpRow } from '../normalize';
import type { CostRecord, RawGcpRow } from '../types';

const PROJECT_ID = process.env.GCP_PROJECT_ID ?? 'agenticbricks-finops';
const BILLING_DATASET = process.env.BILLING_DATASET ?? 'billing_export';
const BILLING_TABLE = `\`${PROJECT_ID}.${BILLING_DATASET}.gcp_billing_export_v1_*\``;

const bq = new BigQuery({ projectId: PROJECT_ID });

export async function fetchGcpCosts(date: string): Promise<CostRecord[]> {
  const [rows] = await bq.query({
    query: `
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE(usage_start_time)) AS date,
        project.id AS project,
        service.description AS resource,
        ROUND(SUM(cost), 6) AS cost_usd
      FROM ${BILLING_TABLE}
      WHERE DATE(usage_start_time) = @target_date
      GROUP BY 1, 2, 3
    `,
    params: { target_date: date },
    location: 'US',
  });

  return (rows as RawGcpRow[]).map(normalizeGcpRow);
}
