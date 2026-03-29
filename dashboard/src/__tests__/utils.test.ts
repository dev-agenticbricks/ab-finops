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
