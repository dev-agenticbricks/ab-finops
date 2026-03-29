# FinOps Dashboard (Phase 1 — GCP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-cost FinOps dashboard that ingests GCP billing data daily via GitHub Actions, stores it in BigQuery, generates a static `costs.json` file, and deploys a React/Vite single-page dashboard to GitHub Pages.

**Architecture:** Two GitHub Actions workflows — `ingest.yml` (daily cron) runs TypeScript scripts that query GCP billing export in BigQuery, normalize rows into a unified `CostRecord` schema, upsert into `normalized_costs` table, then write last 90 days to `dashboard/data/costs.json` and commit. `deploy.yml` (triggers on ingest success) runs `vite build` and deploys `dist/` to GitHub Pages via `gh-pages` branch.

**Tech Stack:** TypeScript, Node.js 20, tsx (runner), @google-cloud/bigquery, vitest, React 18, Vite 5, Recharts, Tailwind CSS v3, @testing-library/react, GitHub Actions, GitHub Pages (peaceiris/actions-gh-pages)

---

## File Map

```
ab-finops/
  package.json                          # npm workspaces root
  .gitignore                            # add node_modules, dist, .env, .superpowers

  ingestion/
    package.json                        # deps: @google-cloud/bigquery, tsx; dev: vitest, @types/node
    tsconfig.json                       # target ES2020, module commonjs
    vitest.config.ts
    src/
      types.ts                          # CostRecord interface + RawGcpRow interface
      normalize.ts                      # rawGcpRow → CostRecord
      bigquery.ts                       # ensureTable(), upsertCosts(), queryCosts()
      export.ts                         # queryCosts(90) → writes costs.json
      index.ts                          # main(): orchestrates ingest run
      connectors/
        gcp.ts                          # fetchGcpCosts(date) → CostRecord[]
        claude.ts                       # stub: export async function fetchClaudeCosts() { return []; }
        vercel.ts                       # stub
        godaddy.ts                      # stub
        workspace.ts                    # stub
    src/__tests__/
      normalize.test.ts
      bigquery.test.ts
      gcp.test.ts
      export.test.ts

  dashboard/
    package.json                        # deps: react, recharts; dev: vite, tailwindcss, vitest
    tsconfig.json                       # target ESNext, jsx react-jsx, moduleResolution bundler
    tsconfig.node.json                  # for vite.config.ts
    vite.config.ts                      # base: VITE_BASE_URL env, @vitejs/plugin-react
    tailwind.config.ts
    postcss.config.js
    index.html
    vitest.config.ts
    src/
      main.tsx
      App.tsx                           # single-page layout, date filter state
      types.ts                          # CostRecord, CostsData interfaces
      utils.ts                          # filterByDays, getTotalCost, sumCostsByPlatform, getDailyTotals, getTopResources
      components/
        KpiCard.tsx
        SpendChart.tsx                  # Recharts BarChart, stacked by platform
        PlatformBreakdown.tsx           # percentage list per platform
        CostTable.tsx                   # sortable table of top resources
    src/__tests__/
      utils.test.ts
      KpiCard.test.tsx
      SpendChart.test.tsx
      PlatformBreakdown.test.tsx
      CostTable.test.tsx
    data/
      costs.json                        # seed data (committed); overwritten by export.ts nightly

  .github/workflows/
    ingest.yml
    deploy.yml
```

---

## Task 1: Root workspace setup

**Files:**
- Create: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "ab-finops",
  "private": true,
  "workspaces": ["ingestion", "dashboard"],
  "scripts": {
    "ingest": "npm run ingest -w ingestion",
    "export": "npm run export -w ingestion",
    "test": "npm run test -w ingestion && npm run test -w dashboard"
  }
}
```

- [ ] **Step 2: Update .gitignore**

```
node_modules/
dist/
.env
.env.local
*.json.key
.superpowers/
```

> `dashboard/data/costs.json` is intentionally committed and tracked in git. The ingest job updates and re-commits it nightly.

- [ ] **Step 3: Create seed costs.json so the dashboard renders before first real ingest**

```bash
mkdir -p dashboard/data
```

Create `dashboard/data/costs.json`:

```json
{
  "generated_at": "2026-03-29T06:00:00.000Z",
  "window_days": 90,
  "records": [
    { "date": "2026-03-28", "platform": "GCP", "project": "prod", "resource": "Cloud Run", "cost_usd": 18.40, "metadata": {} },
    { "date": "2026-03-28", "platform": "GCP", "project": "prod", "resource": "BigQuery", "cost_usd": 4.20, "metadata": {} },
    { "date": "2026-03-27", "platform": "GCP", "project": "prod", "resource": "Cloud Run", "cost_usd": 16.80, "metadata": {} },
    { "date": "2026-03-27", "platform": "GCP", "project": "prod", "resource": "Cloud Storage", "cost_usd": 1.10, "metadata": {} },
    { "date": "2026-03-26", "platform": "GCP", "project": "prod", "resource": "Cloud Run", "cost_usd": 20.00, "metadata": {} }
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore dashboard/data/costs.json
git commit -m "chore: root workspace setup + seed costs.json"
```

---

## Task 2: Ingestion package setup

**Files:**
- Create: `ingestion/package.json`, `ingestion/tsconfig.json`, `ingestion/vitest.config.ts`

- [ ] **Step 1: Create ingestion/package.json**

```json
{
  "name": "ingestion",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "tsc",
    "ingest": "tsx src/index.ts",
    "export": "tsx src/export.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@google-cloud/bigquery": "^7.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 2: Create ingestion/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create ingestion/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
});
```

- [ ] **Step 4: Install dependencies (run from repo root)**

```bash
npm install
```

Expected: root `package-lock.json` created/updated, `ingestion/node_modules/` created with `@google-cloud/bigquery` installed.

- [ ] **Step 5: Commit**

```bash
git add ingestion/package.json ingestion/tsconfig.json ingestion/vitest.config.ts package-lock.json
git commit -m "chore: ingestion package setup"
```

---

## Task 3: Types

**Files:**
- Create: `ingestion/src/types.ts`

- [ ] **Step 1: Create ingestion/src/types.ts**

```typescript
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
```

- [ ] **Step 2: Verify it compiles**

```bash
cd ingestion && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add ingestion/src/types.ts
git commit -m "feat: shared CostRecord and RawGcpRow types"
```

---

## Task 4: normalize.ts (TDD)

**Files:**
- Create: `ingestion/src/normalize.ts`, `ingestion/src/__tests__/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

Create `ingestion/src/__tests__/normalize.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeGcpRow } from '../normalize';
import type { RawGcpRow } from '../types';

describe('normalizeGcpRow', () => {
  it('maps a raw GCP billing row to a CostRecord', () => {
    const raw: RawGcpRow = {
      date: '2026-03-28',
      project: 'my-project',
      resource: 'Cloud Run',
      cost_usd: 12.5,
    };

    const result = normalizeGcpRow(raw);

    expect(result).toEqual({
      date: '2026-03-28',
      platform: 'GCP',
      project: 'my-project',
      resource: 'Cloud Run',
      cost_usd: 12.5,
      metadata: {},
    });
  });

  it('rounds cost_usd to 6 decimal places', () => {
    const raw: RawGcpRow = { date: '2026-03-28', project: 'p', resource: 'r', cost_usd: 1.123456789 };
    const result = normalizeGcpRow(raw);
    expect(result.cost_usd).toBe(1.123457);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd ingestion && npm test
```

Expected: FAIL — `Cannot find module '../normalize'`

- [ ] **Step 3: Implement normalize.ts**

Create `ingestion/src/normalize.ts`:

```typescript
import type { CostRecord, RawGcpRow } from './types';

export function normalizeGcpRow(raw: RawGcpRow): CostRecord {
  return {
    date: raw.date,
    platform: 'GCP',
    project: raw.project,
    resource: raw.resource,
    cost_usd: parseFloat(raw.cost_usd.toFixed(6)),
    metadata: {},
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ingestion && npm test
```

Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add ingestion/src/normalize.ts ingestion/src/__tests__/normalize.test.ts
git commit -m "feat: normalizeGcpRow maps raw billing row to CostRecord"
```

---

## Task 5: bigquery.ts (TDD)

**Files:**
- Create: `ingestion/src/bigquery.ts`, `ingestion/src/__tests__/bigquery.test.ts`

- [ ] **Step 1: Write the failing test**

Create `ingestion/src/__tests__/bigquery.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @google-cloud/bigquery before importing bigquery.ts
const mockQuery = vi.fn();
const mockInsert = vi.fn();
const mockExists = vi.fn();
const mockCreate = vi.fn();

vi.mock('@google-cloud/bigquery', () => {
  return {
    BigQuery: vi.fn().mockImplementation(() => ({
      query: mockQuery,
      dataset: () => ({
        table: () => ({
          exists: mockExists,
          create: mockCreate,
          insert: mockInsert,
        }),
      }),
    })),
  };
});

import { upsertCosts, queryCosts, ensureTable } from '../bigquery';
import type { CostRecord } from '../types';

const sampleRecords: CostRecord[] = [
  { date: '2026-03-28', platform: 'GCP', project: 'prod', resource: 'Cloud Run', cost_usd: 10.0, metadata: {} },
];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GCP_PROJECT_ID = 'test-project';
});

describe('ensureTable', () => {
  it('creates normalized_costs table if it does not exist', async () => {
    mockExists.mockResolvedValueOnce([false]); // normalized_costs
    mockCreate.mockResolvedValueOnce(undefined);
    mockExists.mockResolvedValueOnce([false]); // daily_aggregates view
    mockCreate.mockResolvedValueOnce(undefined);

    await ensureTable();

    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('skips creation if table already exists', async () => {
    mockExists.mockResolvedValue([true]);

    await ensureTable();

    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('upsertCosts', () => {
  it('deletes existing rows then inserts new ones', async () => {
    mockQuery.mockResolvedValueOnce(undefined);
    mockInsert.mockResolvedValueOnce(undefined);

    await upsertCosts(sampleRecords, '2026-03-28', 'GCP');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ date: '2026-03-28', platform: 'GCP' }) })
    );
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ date: '2026-03-28', platform: 'GCP' })])
    );
  });

  it('skips insert if records array is empty', async () => {
    await upsertCosts([], '2026-03-28', 'GCP');
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe('queryCosts', () => {
  it('returns records from the last N days', async () => {
    mockQuery.mockResolvedValueOnce([sampleRecords]);

    const results = await queryCosts(30);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ window_days: 30 }) })
    );
    expect(results).toEqual(sampleRecords);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd ingestion && npm test
```

Expected: FAIL — `Cannot find module '../bigquery'`

- [ ] **Step 3: Implement bigquery.ts**

Create `ingestion/src/bigquery.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests**

```bash
cd ingestion && npm test
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add ingestion/src/bigquery.ts ingestion/src/__tests__/bigquery.test.ts
git commit -m "feat: bigquery client with ensureTable, upsertCosts, queryCosts"
```

---

## Task 6: GCP connector (TDD)

**Files:**
- Create: `ingestion/src/connectors/gcp.ts`, `ingestion/src/__tests__/gcp.test.ts`
- Create stubs: `ingestion/src/connectors/claude.ts`, `vercel.ts`, `godaddy.ts`, `workspace.ts`

- [ ] **Step 1: Write the failing test**

Create `ingestion/src/__tests__/gcp.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();

vi.mock('@google-cloud/bigquery', () => ({
  BigQuery: vi.fn().mockImplementation(() => ({ query: mockQuery })),
}));

import { fetchGcpCosts } from '../connectors/gcp';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GCP_PROJECT_ID = 'test-project';
  process.env.BILLING_DATASET = 'billing_export';
});

describe('fetchGcpCosts', () => {
  it('queries GCP billing export and returns normalized CostRecords', async () => {
    mockQuery.mockResolvedValueOnce([[
      { date: '2026-03-28', project: 'my-project', resource: 'Cloud Run', cost_usd: 42.5 },
    ]]);

    const records = await fetchGcpCosts('2026-03-28');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ target_date: '2026-03-28' }) })
    );
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      date: '2026-03-28',
      platform: 'GCP',
      project: 'my-project',
      resource: 'Cloud Run',
      cost_usd: 42.5,
    });
  });

  it('returns empty array when no data for the date', async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const records = await fetchGcpCosts('2026-03-28');
    expect(records).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd ingestion && npm test -- gcp.test.ts
```

Expected: FAIL — `Cannot find module '../connectors/gcp'`

- [ ] **Step 3: Implement gcp.ts**

Create `ingestion/src/connectors/gcp.ts`:

```typescript
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
```

- [ ] **Step 4: Create connector stubs**

Create `ingestion/src/connectors/claude.ts`:
```typescript
import type { CostRecord } from '../types';
export async function fetchClaudeCosts(_date: string): Promise<CostRecord[]> { return []; }
```

Create `ingestion/src/connectors/vercel.ts`:
```typescript
import type { CostRecord } from '../types';
export async function fetchVercelCosts(_date: string): Promise<CostRecord[]> { return []; }
```

Create `ingestion/src/connectors/godaddy.ts`:
```typescript
import type { CostRecord } from '../types';
export async function fetchGodaddyCosts(_date: string): Promise<CostRecord[]> { return []; }
```

Create `ingestion/src/connectors/workspace.ts`:
```typescript
import type { CostRecord } from '../types';
export async function fetchWorkspaceCosts(_date: string): Promise<CostRecord[]> { return []; }
```

- [ ] **Step 5: Run all tests**

```bash
cd ingestion && npm test
```

Expected: PASS — all tests including gcp.test.ts (2 new).

- [ ] **Step 6: Commit**

```bash
git add ingestion/src/connectors/
git add ingestion/src/__tests__/gcp.test.ts
git commit -m "feat: GCP billing connector + stub connectors for other platforms"
```

---

## Task 7: export.ts (TDD)

**Files:**
- Create: `ingestion/src/export.ts`, `ingestion/src/__tests__/export.test.ts`

- [ ] **Step 1: Write the failing test**

Create `ingestion/src/__tests__/export.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFileSync } from 'fs';
import path from 'path';

vi.mock('../bigquery', () => ({
  queryCosts: vi.fn(),
}));

vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { queryCosts } from '../bigquery';
import { exportToJson } from '../export';
import type { CostRecord } from '../types';

const sampleRecords: CostRecord[] = [
  { date: '2026-03-28', platform: 'GCP', project: 'prod', resource: 'Cloud Run', cost_usd: 10.0, metadata: {} },
];

beforeEach(() => vi.clearAllMocks());

describe('exportToJson', () => {
  it('writes costs.json with correct structure', async () => {
    vi.mocked(queryCosts).mockResolvedValueOnce(sampleRecords);

    await exportToJson('/tmp/costs.json', 90);

    expect(queryCosts).toHaveBeenCalledWith(90);
    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/costs.json',
      expect.stringContaining('"window_days": 90'),
    );
    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
    expect(written.records).toHaveLength(1);
    expect(written.records[0].platform).toBe('GCP');
    expect(written.generated_at).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd ingestion && npm test -- export.test.ts
```

Expected: FAIL — `Cannot find module '../export'`

- [ ] **Step 3: Implement export.ts**

Create `ingestion/src/export.ts`:

```typescript
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
```

- [ ] **Step 4: Run all tests**

```bash
cd ingestion && npm test
```

Expected: PASS — all tests.

- [ ] **Step 5: Commit**

```bash
git add ingestion/src/export.ts ingestion/src/__tests__/export.test.ts
git commit -m "feat: export.ts queries BigQuery and writes costs.json"
```

---

## Task 8: Ingestion entry point

**Files:**
- Create: `ingestion/src/index.ts`

- [ ] **Step 1: Create ingestion/src/index.ts**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ingestion && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add ingestion/src/index.ts
git commit -m "feat: ingestion entry point orchestrates GCP ingest + export"
```

---

## Task 9: Dashboard package setup

**Files:**
- Create: `dashboard/package.json`, `dashboard/tsconfig.json`, `dashboard/tsconfig.node.json`, `dashboard/vite.config.ts`, `dashboard/tailwind.config.ts`, `dashboard/postcss.config.js`, `dashboard/index.html`, `dashboard/vitest.config.ts`

- [ ] **Step 1: Create dashboard/package.json**

```json
{
  "name": "dashboard",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^15.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "jsdom": "^24.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 2: Create dashboard/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create dashboard/tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "tailwind.config.ts"]
}
```

- [ ] **Step 4: Create dashboard/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_URL ?? '/',
});
```

- [ ] **Step 5: Create dashboard/tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 6: Create dashboard/postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 7: Create dashboard/index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Agenticbricks FinOps</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Create dashboard/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
```

- [ ] **Step 9: Create dashboard/src/__tests__/setup.ts**

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 10: Create dashboard/src/main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 11: Create dashboard/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 12: Install dependencies (run from repo root)**

```bash
npm install
```

Expected: root `package-lock.json` updated, `dashboard/node_modules/` created.

- [ ] **Step 13: Commit**

```bash
git add dashboard/package.json dashboard/tsconfig.json dashboard/tsconfig.node.json dashboard/vite.config.ts dashboard/tailwind.config.ts dashboard/postcss.config.js dashboard/index.html dashboard/vitest.config.ts dashboard/src/__tests__/setup.ts dashboard/src/main.tsx dashboard/src/index.css package-lock.json
git commit -m "chore: dashboard package setup (Vite + React + Tailwind + Recharts)"
```

---

## Task 10: Dashboard types, utils, and seed data

**Files:**
- Create: `dashboard/src/types.ts`, `dashboard/src/utils.ts`, `dashboard/src/__tests__/utils.test.ts`

- [ ] **Step 1: Create dashboard/src/types.ts**

```typescript
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
```

- [ ] **Step 2: Write failing utils tests**

Create `dashboard/src/__tests__/utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { filterByDays, getTotalCost, sumCostsByPlatform, getDailyTotals, getTopResources } from '../utils';
import type { CostRecord } from '../types';

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const oldDate = '2020-01-01';

const records: CostRecord[] = [
  { date: today, platform: 'GCP', project: 'prod', resource: 'Cloud Run', cost_usd: 10, metadata: {} },
  { date: yesterday, platform: 'GCP', project: 'prod', resource: 'BigQuery', cost_usd: 5, metadata: {} },
  { date: oldDate, platform: 'Claude', project: 'prod', resource: 'claude-3-5-sonnet', cost_usd: 100, metadata: {} },
];

describe('filterByDays', () => {
  it('keeps records within the window', () => {
    const result = filterByDays(records, 7);
    expect(result).toHaveLength(2);
    expect(result.every(r => r.date !== oldDate)).toBe(true);
  });

  it('keeps all records when window is 90', () => {
    const result = filterByDays(records, 90);
    // oldDate is from 2020, outside 90 days
    expect(result).toHaveLength(2);
  });
});

describe('getTotalCost', () => {
  it('sums all cost_usd values', () => {
    expect(getTotalCost(records)).toBe(115);
  });

  it('returns 0 for empty array', () => {
    expect(getTotalCost([])).toBe(0);
  });
});

describe('sumCostsByPlatform', () => {
  it('groups costs by platform', () => {
    const result = sumCostsByPlatform(records);
    expect(result['GCP']).toBe(15);
    expect(result['Claude']).toBe(100);
  });
});

describe('getDailyTotals', () => {
  it('returns one entry per date sorted ascending', () => {
    const result = getDailyTotals(records);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].date < result[result.length - 1].date).toBe(true);
  });
});

describe('getTopResources', () => {
  it('returns resources sorted by cost descending', () => {
    const result = getTopResources(records);
    expect(result[0].cost_usd).toBeGreaterThanOrEqual(result[1]?.cost_usd ?? 0);
  });

  it('respects limit parameter', () => {
    const result = getTopResources(records, 1);
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
cd dashboard && npm test
```

Expected: FAIL — `Cannot find module '../utils'`

- [ ] **Step 4: Implement utils.ts**

Create `dashboard/src/utils.ts`:

```typescript
import type { CostRecord } from './types';

export function filterByDays(records: CostRecord[], days: number): CostRecord[] {
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
```

- [ ] **Step 5: Run tests**

```bash
cd dashboard && npm test
```

Expected: PASS — all utils tests.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/types.ts dashboard/src/utils.ts dashboard/src/__tests__/utils.test.ts
git commit -m "feat: dashboard types and data utilities"
```

---

## Task 11: KpiCard component (TDD)

**Files:**
- Create: `dashboard/src/components/KpiCard.tsx`, `dashboard/src/__tests__/KpiCard.test.tsx`

- [ ] **Step 1: Write failing test**

Create `dashboard/src/__tests__/KpiCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCard } from '../components/KpiCard';

describe('KpiCard', () => {
  it('renders label and formatted value', () => {
    render(<KpiCard label="Total This Month" value={1234.56} />);
    expect(screen.getByText('Total This Month')).toBeInTheDocument();
    expect(screen.getByText('$1,234.56')).toBeInTheDocument();
  });

  it('applies the color prop to the value', () => {
    render(<KpiCard label="GCP" value={42} color="text-blue-400" />);
    const value = screen.getByText('$42.00');
    expect(value).toHaveClass('text-blue-400');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd dashboard && npm test -- KpiCard
```

Expected: FAIL — `Cannot find module '../components/KpiCard'`

- [ ] **Step 3: Implement KpiCard.tsx**

Create `dashboard/src/components/KpiCard.tsx`:

```tsx
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
```

- [ ] **Step 4: Run tests**

```bash
cd dashboard && npm test -- KpiCard
```

Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/KpiCard.tsx dashboard/src/__tests__/KpiCard.test.tsx
git commit -m "feat: KpiCard component"
```

---

## Task 12: SpendChart component (TDD)

**Files:**
- Create: `dashboard/src/components/SpendChart.tsx`, `dashboard/src/__tests__/SpendChart.test.tsx`

- [ ] **Step 1: Write failing test**

Create `dashboard/src/__tests__/SpendChart.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpendChart } from '../components/SpendChart';

// Recharts uses ResizeObserver which is unavailable in jsdom
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

const data = [
  { date: '2026-03-27', GCP: 20 },
  { date: '2026-03-28', GCP: 22.6 },
];

describe('SpendChart', () => {
  it('renders without crashing', () => {
    render(<SpendChart data={data} platforms={['GCP']} />);
    expect(screen.getByRole('figure')).toBeInTheDocument();
  });

  it('renders a title', () => {
    render(<SpendChart data={data} platforms={['GCP']} />);
    expect(screen.getByText('Daily Spend')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd dashboard && npm test -- SpendChart
```

Expected: FAIL — `Cannot find module '../components/SpendChart'`

- [ ] **Step 3: Implement SpendChart.tsx**

Create `dashboard/src/components/SpendChart.tsx`:

```tsx
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
```

- [ ] **Step 4: Run tests**

```bash
cd dashboard && npm test -- SpendChart
```

Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/SpendChart.tsx dashboard/src/__tests__/SpendChart.test.tsx
git commit -m "feat: SpendChart stacked bar chart component"
```

---

## Task 13: PlatformBreakdown component (TDD)

**Files:**
- Create: `dashboard/src/components/PlatformBreakdown.tsx`, `dashboard/src/__tests__/PlatformBreakdown.test.tsx`

- [ ] **Step 1: Write failing test**

Create `dashboard/src/__tests__/PlatformBreakdown.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformBreakdown } from '../components/PlatformBreakdown';

const costs = { GCP: 80, Claude: 20 };

describe('PlatformBreakdown', () => {
  it('renders each platform name', () => {
    render(<PlatformBreakdown costs={costs} />);
    expect(screen.getByText('GCP')).toBeInTheDocument();
    expect(screen.getByText('Claude')).toBeInTheDocument();
  });

  it('shows correct percentages', () => {
    render(<PlatformBreakdown costs={costs} />);
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('shows $0.00 / 0% for empty costs', () => {
    render(<PlatformBreakdown costs={{}} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd dashboard && npm test -- PlatformBreakdown
```

Expected: FAIL — `Cannot find module '../components/PlatformBreakdown'`

- [ ] **Step 3: Implement PlatformBreakdown.tsx**

Create `dashboard/src/components/PlatformBreakdown.tsx`:

```tsx
const PLATFORM_COLORS: Record<string, string> = {
  GCP: 'bg-blue-400',
  Claude: 'bg-violet-400',
  Vercel: 'bg-emerald-400',
  GoDaddy: 'bg-amber-400',
  Workspace: 'bg-rose-400',
};

interface PlatformBreakdownProps {
  costs: Record<string, number>;
}

export function PlatformBreakdown({ costs }: PlatformBreakdownProps) {
  const total = Object.values(costs).reduce((s, v) => s + v, 0);
  const entries = Object.entries(costs).sort(([, a], [, b]) => b - a);

  if (entries.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-xs text-slate-400 uppercase tracking-wide mb-3">By Platform</h3>
        <p className="text-slate-500 text-sm">No data</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <h3 className="text-xs text-slate-400 uppercase tracking-wide mb-3">By Platform</h3>
      <ul className="space-y-2">
        {entries.map(([platform, cost]) => {
          const pct = total > 0 ? Math.round((cost / total) * 100) : 0;
          const bar = PLATFORM_COLORS[platform] ?? 'bg-slate-400';
          return (
            <li key={platform}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-200">{platform}</span>
                <span className="text-slate-400">{pct}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div className={`${bar} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd dashboard && npm test -- PlatformBreakdown
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/PlatformBreakdown.tsx dashboard/src/__tests__/PlatformBreakdown.test.tsx
git commit -m "feat: PlatformBreakdown component shows cost share per platform"
```

---

## Task 14: CostTable component (TDD)

**Files:**
- Create: `dashboard/src/components/CostTable.tsx`, `dashboard/src/__tests__/CostTable.test.tsx`

- [ ] **Step 1: Write failing test**

Create `dashboard/src/__tests__/CostTable.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CostTable } from '../components/CostTable';
import type { CostRecord } from '../types';

const records: CostRecord[] = [
  { date: '2026-03-28', platform: 'GCP', project: 'prod', resource: 'Cloud Run', cost_usd: 42, metadata: {} },
  { date: '2026-03-28', platform: 'Claude', project: 'prod', resource: 'claude-3-5-sonnet', cost_usd: 18, metadata: {} },
  { date: '2026-03-27', platform: 'GCP', project: 'prod', resource: 'BigQuery', cost_usd: 5, metadata: {} },
];

describe('CostTable', () => {
  it('renders all records', () => {
    render(<CostTable records={records} />);
    expect(screen.getByText('Cloud Run')).toBeInTheDocument();
    expect(screen.getByText('claude-3-5-sonnet')).toBeInTheDocument();
    expect(screen.getByText('BigQuery')).toBeInTheDocument();
  });

  it('filters by platform when platform filter is set', async () => {
    render(<CostTable records={records} />);
    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, 'GCP');
    expect(screen.getByText('Cloud Run')).toBeInTheDocument();
    expect(screen.queryByText('claude-3-5-sonnet')).not.toBeInTheDocument();
  });

  it('shows "No data" when records is empty', () => {
    render(<CostTable records={[]} />);
    expect(screen.getByText('No data for the selected period.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd dashboard && npm test -- CostTable
```

Expected: FAIL — `Cannot find module '../components/CostTable'`

- [ ] **Step 3: Implement CostTable.tsx**

Create `dashboard/src/components/CostTable.tsx`:

```tsx
import { useState } from 'react';
import type { CostRecord } from '../types';

const PLATFORMS = ['All', 'GCP', 'Claude', 'Vercel', 'GoDaddy', 'Workspace'];

interface CostTableProps {
  records: CostRecord[];
}

export function CostTable({ records }: CostTableProps) {
  const [platform, setPlatform] = useState('All');

  const filtered = platform === 'All' ? records : records.filter(r => r.platform === platform);

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs text-slate-400 uppercase tracking-wide">Top Resources</h3>
        <select
          value={platform}
          onChange={e => setPlatform(e.target.value)}
          className="text-xs bg-slate-700 text-slate-200 rounded px-2 py-1 border border-slate-600"
        >
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-slate-500 text-sm">No data for the selected period.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-700">
              <th className="text-left py-2">Date</th>
              <th className="text-left py-2">Platform</th>
              <th className="text-left py-2">Resource</th>
              <th className="text-right py-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="py-2 text-slate-400">{r.date}</td>
                <td className="py-2 text-slate-300">{r.platform}</td>
                <td className="py-2 text-slate-200">{r.resource}</td>
                <td className="py-2 text-right text-slate-100 font-mono">
                  ${r.cost_usd.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd dashboard && npm test -- CostTable
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/CostTable.tsx dashboard/src/__tests__/CostTable.test.tsx
git commit -m "feat: CostTable component with platform filter"
```

---

## Task 15: App.tsx — single-page layout

**Files:**
- Create: `dashboard/src/App.tsx`

- [ ] **Step 1: Create dashboard/src/App.tsx**

```tsx
import { useState } from 'react';
import type { DateRange, CostsData } from './types';
import { filterByDays, getTotalCost, sumCostsByPlatform, getDailyTotals, getTopResources } from './utils';
import { KpiCard } from './components/KpiCard';
import { SpendChart } from './components/SpendChart';
import { PlatformBreakdown } from './components/PlatformBreakdown';
import { CostTable } from './components/CostTable';
import costsData from '../data/costs.json';

const data = costsData as CostsData;

const PLATFORM_COLORS: Record<string, string> = {
  GCP: 'text-blue-400',
  Claude: 'text-violet-400',
  Vercel: 'text-emerald-400',
  GoDaddy: 'text-amber-400',
  Workspace: 'text-rose-400',
};

export default function App() {
  const [range, setRange] = useState<DateRange>(30);

  const filtered = filterByDays(data.records, range);
  const total = getTotalCost(filtered);
  const byPlatform = sumCostsByPlatform(filtered);
  const dailyTotals = getDailyTotals(filtered);
  const platforms = [...new Set(filtered.map(r => r.platform))];
  const topResources = getTopResources(filtered);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Agenticbricks FinOps</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Last updated: {new Date(data.generated_at).toLocaleString()}
          </p>
        </div>
        <select
          value={range}
          onChange={e => setRange(Number(e.target.value) as DateRange)}
          className="bg-slate-800 text-slate-200 text-sm rounded px-3 py-1.5 border border-slate-600"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Total" value={total} />
        {Object.entries(byPlatform).map(([p, cost]) => (
          <KpiCard key={p} label={p} value={cost} color={PLATFORM_COLORS[p]} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <SpendChart data={dailyTotals} platforms={platforms} />
        </div>
        <PlatformBreakdown costs={byPlatform} />
      </div>

      {/* Table */}
      <CostTable records={topResources} />
    </div>
  );
}
```

- [ ] **Step 2: Run the dev server and verify it renders**

```bash
cd dashboard && npm run dev
```

Expected: server starts at `http://localhost:5173`, open in browser, dashboard renders with seed data showing KPI cards, chart, and table.

- [ ] **Step 3: Run all dashboard tests**

```bash
cd dashboard && npm test
```

Expected: PASS — all tests.

- [ ] **Step 4: Verify production build works**

```bash
cd dashboard && npm run build
```

Expected: `dist/` directory created, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/App.tsx
git commit -m "feat: single-page dashboard App with date filter and all components"
```

---

## Task 16: GitHub Actions workflows

**Files:**
- Create: `.github/workflows/ingest.yml`, `.github/workflows/deploy.yml`

- [ ] **Step 1: Create .github/workflows/ingest.yml**

```yaml
name: Ingest Cost Data

on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

jobs:
  ingest:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SERVICE_ACCOUNT_KEY }}

      - name: Run ingestion
        run: npm run ingest
        env:
          GCP_PROJECT_ID: agenticbricks-finops
          BILLING_DATASET: billing_export

      - name: Commit updated costs.json
        run: |
          git config --global user.name 'github-actions[bot]'
          git config --global user.email 'github-actions[bot]@users.noreply.github.com'
          git add dashboard/data/costs.json
          git diff --staged --quiet || git commit -m "chore: update costs.json [skip ci]"
          git push
```

- [ ] **Step 2: Create .github/workflows/deploy.yml**

```yaml
name: Deploy Dashboard

on:
  workflow_run:
    workflows: ["Ingest Cost Data"]
    types: [completed]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: ${{ github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success' }}
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build dashboard
        run: npm run build -w dashboard
        env:
          VITE_BASE_URL: /ab-finops/

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dashboard/dist
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ingest.yml .github/workflows/deploy.yml
git commit -m "ci: GitHub Actions for daily ingestion and GH Pages deployment"
```

---

## Task 17: Final wiring and verification

- [ ] **Step 1: Run all tests from root**

```bash
npm test
```

Expected: all ingestion and dashboard tests pass.

- [ ] **Step 2: Verify ingestion TypeScript compiles**

```bash
cd ingestion && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify dashboard production build**

```bash
cd dashboard && npm run build
```

Expected: `dist/` created with `index.html` and assets.

- [ ] **Step 4: Update root package-lock.json**

```bash
cd .. && npm install
git add package-lock.json
git commit -m "chore: update root lockfile"
```

- [ ] **Step 5: Final status check**

```bash
git log --oneline -15
```

Expected: clean commit history with all tasks committed.

- [ ] **Step 6: Push to GitHub**

```bash
git push origin main
```

Then:
1. Go to repo Settings → Pages → set source to `gh-pages` branch
2. Add `GCP_SERVICE_ACCOUNT_KEY` secret in Settings → Secrets → Actions
3. Run `Ingest Cost Data` workflow manually from Actions tab (first run)
4. After it succeeds, `Deploy Dashboard` will trigger automatically

---

## GCP One-Time Setup (do before first workflow run)

Run these in the GCP Console or `gcloud` CLI:

```bash
# 1. Create project
gcloud projects create agenticbricks-finops --name="Agenticbricks FinOps"
gcloud config set project agenticbricks-finops

# 2. Enable billing export in Console:
#    Billing → Billing export → BigQuery export → Enable
#    Dataset name: billing_export

# 3. Create finops dataset
bq mk --dataset agenticbricks-finops:finops

# 4. Create service account
gcloud iam service-accounts create finops-ingest \
  --display-name="FinOps Ingestion"

# 5. Grant roles
gcloud projects add-iam-policy-binding agenticbricks-finops \
  --member="serviceAccount:finops-ingest@agenticbricks-finops.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"

bq add-iam-policy-binding --member="serviceAccount:finops-ingest@agenticbricks-finops.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer" agenticbricks-finops:billing_export

bq add-iam-policy-binding --member="serviceAccount:finops-ingest@agenticbricks-finops.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor" agenticbricks-finops:finops

# 6. Export key
gcloud iam service-accounts keys create /tmp/finops-key.json \
  --iam-account=finops-ingest@agenticbricks-finops.iam.gserviceaccount.com

# Copy contents of /tmp/finops-key.json → GitHub secret GCP_SERVICE_ACCOUNT_KEY
```
