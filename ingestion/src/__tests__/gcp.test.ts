import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());

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
