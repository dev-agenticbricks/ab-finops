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

  it('shows "No data" when costs is empty', () => {
    render(<PlatformBreakdown costs={{}} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });
});
