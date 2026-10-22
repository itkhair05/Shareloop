import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorAlert, EmptyState, LoadingSpinner, StatusBanner } from '../Feedback';

describe('Feedback components', () => {
  it('renders LoadingSpinner with accessible status role', () => {
    render(<LoadingSpinner label="Fetching data..." />);
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(screen.getAllByText('Fetching data...')[0]).toBeInTheDocument();
  });

  it('renders EmptyState with title, description, and action button', async () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="No items found"
        description="Try adjusting your search criteria."
        actionLabel="Reset Search"
        onAction={handleAction}
      />
    );

    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search criteria.')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: /reset search/i });
    await userEvent.click(button);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('renders ErrorAlert with retry button and triggers callback', async () => {
    const handleRetry = vi.fn();
    render(
      <ErrorAlert
        title="Connection Failed"
        message="Backend server did not respond"
        onRetry={handleRetry}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Connection Failed')).toBeInTheDocument();
    expect(screen.getByText('Backend server did not respond')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /try again/i });
    await userEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('renders StatusBanner with message', () => {
    render(<StatusBanner type="warning" message="Maintenance scheduled tonight" />);
    expect(screen.getByText('Maintenance scheduled tonight')).toBeInTheDocument();
  });
});
