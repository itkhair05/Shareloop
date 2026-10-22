import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';

describe('App root component', () => {
  it('renders application navbar brand and headline', () => {
    render(<App />);

    expect(screen.getAllByText('ShareLoop')[0]).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'ShareLoop' })).toBeInTheDocument();
    expect(screen.getByText(/sustainable neighborhood exchange/i)).toBeInTheDocument();
  });

  it('renders all three core marketplace pillars', () => {
    render(<App />);

    expect(screen.getByText('Free Item Sharing')).toBeInTheDocument();
    expect(screen.getByText('Second-Hand Trading')).toBeInTheDocument();
    expect(screen.getByText('Wanted Item Requests')).toBeInTheDocument();
  });

  it('renders footer with copyright', () => {
    render(<App />);

    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(`© ${year} ShareLoop Platform`, 'i'))).toBeInTheDocument();
  });
});
