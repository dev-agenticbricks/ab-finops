import fs from 'fs';
import path from 'path';
import { queryCosts } from './bigquery';

const DEFAULT_OUTPUT = path.join(process.cwd(), 'dashboard', 'data', 'costs.json');

export async function exportToJson(outputPath: string = DEFAULT_OUTPUT, windowDays = 90): Promise<void> {
  console.log(`Exporting last ${windowDays} days of costs to ${outputPath}...`);
  const records = await queryCosts(windowDays);

  const output = {
    generated_at: new Date().toISOString(),
    window_days: windowDays,
    records,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${records.length} records to ${outputPath}`);
}

// Run when called directly: tsx src/export.ts
if (require.main === module) {
  exportToJson().catch(err => { console.error(err); process.exit(1); });
}
