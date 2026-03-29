import { BigQuery } from '@google-cloud/bigquery';
import type { CostRecord } from './types';

const PROJECT_ID = process.env.GCP_PROJECT_ID ?? 'agenticbricks-finops';
const DATASET = 'finops';
const TABLE = 'normalized_costs';
const FULL_TABLE = `\`${PROJECT_ID}.${DATASET}.${TABLE}\``;

const bq = new BigQuery({ projectId: PROJECT_ID });

const TABLE_SCHEMA = [
  { name: 'date', type: 'DATE' },
  { name: 'platform', type: 'STRING' },
  { name: 'project', type: 'STRING' },
  { name: 'resource', type: 'STRING' },
  { name: 'cost_usd', type: 'FLOAT64' },
  { name: 'metadata', type: 'JSON' },
];

const VIEW_QUERY = `
  SELECT date, platform, project, SUM(cost_usd) AS total_cost_usd
  FROM ${FULL_TABLE}
  GROUP BY date, platform, project
`.trim();

export async function ensureTable(): Promise<void> {
  const dataset = bq.dataset(DATASET);

  const [tableExists] = await dataset.table(TABLE).exists();
  if (!tableExists) {
    await dataset.table(TABLE).create({ schema: TABLE_SCHEMA, timePartitioning: { type: 'DAY', field: 'date' } });
    console.log(`Created table ${TABLE}`);
  }

  const [viewExists] = await dataset.table('daily_aggregates').exists();
  if (!viewExists) {
    await dataset.table('daily_aggregates').create({ view: { query: VIEW_QUERY, useLegacySql: false } });
    console.log('Created view daily_aggregates');
  }
}

export async function upsertCosts(records: CostRecord[], date: string, platform: string): Promise<void> {
  if (records.length === 0) return;

  await bq.query({
    query: `DELETE FROM ${FULL_TABLE} WHERE date = @date AND platform = @platform`,
    params: { date, platform },
    location: 'US',
  });

  const rows = records.map(r => ({ ...r, metadata: JSON.stringify(r.metadata) }));
  await bq.dataset(DATASET).table(TABLE).insert(rows);
  console.log(`Upserted ${rows.length} rows for ${platform} on ${date}`);
}

export async function queryCosts(windowDays: number): Promise<CostRecord[]> {
  const [rows] = await bq.query({
    query: `
      SELECT date, platform, project, resource, cost_usd, metadata
      FROM ${FULL_TABLE}
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL @window_days DAY)
      ORDER BY date DESC
    `,
    params: { window_days: windowDays },
    location: 'US',
  });
  return rows as CostRecord[];
}
