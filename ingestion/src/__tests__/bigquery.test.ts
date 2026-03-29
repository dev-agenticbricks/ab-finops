import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mock variables are available inside the vi.mock factory
const { mockQuery, mockInsert, mockExists, mockCreate } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockInsert: vi.fn(),
  mockExists: vi.fn(),
  mockCreate: vi.fn(),
}));

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
  // Note: GCP_PROJECT_ID is read at module load time (bq is already instantiated).
  // This env var has no effect on the mocked BigQuery client in tests.
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
    // BigQuery returns metadata as a JSON string; queryCosts deserialises it.
    const rawRows = sampleRecords.map(r => ({ ...r, metadata: JSON.stringify(r.metadata) }));
    mockQuery.mockResolvedValueOnce([rawRows]);

    const results = await queryCosts(30);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ window_days: 30 }) })
    );
    expect(results).toEqual(sampleRecords);
  });
});
