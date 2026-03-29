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
