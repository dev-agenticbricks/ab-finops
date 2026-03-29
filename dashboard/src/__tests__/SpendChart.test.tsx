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
