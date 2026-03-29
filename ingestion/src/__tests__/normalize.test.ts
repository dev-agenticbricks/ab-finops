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

  it('replaces null resource with empty string', () => {
    const raw = { date: '2026-03-28', project: 'p', resource: null as unknown as string, cost_usd: 5 };
    const result = normalizeGcpRow(raw);
    expect(result.resource).toBe('');
  });
});
