import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQueryCosts = vi.hoisted(() => vi.fn());
const mockWriteFileSync = vi.hoisted(() => vi.fn());
const mockMkdirSync = vi.hoisted(() => vi.fn());

vi.mock('../bigquery', () => ({
  queryCosts: mockQueryCosts,
}));

vi.mock('fs', () => ({
  default: {
    writeFileSync: mockWriteFileSync,
    mkdirSync: mockMkdirSync,
  },
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}));

import { exportToJson } from '../export';
import type { CostRecord } from '../types';

const sampleRecords: CostRecord[] = [
  { date: '2026-03-28', platform: 'GCP', project: 'prod', resource: 'Cloud Run', cost_usd: 10.0, metadata: {} },
];

beforeEach(() => vi.clearAllMocks());

describe('exportToJson', () => {
  it('writes costs.json with correct structure', async () => {
    mockQueryCosts.mockResolvedValueOnce(sampleRecords);

    await exportToJson('/tmp/costs.json', 90);

    expect(mockQueryCosts).toHaveBeenCalledWith(90);
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/tmp/costs.json',
      expect.stringContaining('"window_days": 90'),
    );
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.records).toHaveLength(1);
    expect(written.records[0].platform).toBe('GCP');
    expect(written.generated_at).toBeDefined();
  });
});
