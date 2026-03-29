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
