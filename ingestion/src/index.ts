import { ensureTable, upsertCosts } from './bigquery';
import { exportToJson } from './export';
import { fetchGcpCosts } from './connectors/gcp';

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const date = process.env.INGEST_DATE ?? getYesterday();
  console.log(`Starting ingestion for ${date}`);

  await ensureTable();

  // GCP
  const gcpRecords = await fetchGcpCosts(date);
  console.log(`Fetched ${gcpRecords.length} GCP records`);
  await upsertCosts(gcpRecords, date, 'GCP');

  // Phase 2 connectors go here (fetchClaudeCosts, fetchVercelCosts, etc.)

  await exportToJson();
  console.log('Ingestion complete');
}

main().catch(err => { console.error(err); process.exit(1); });
