import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorAlert, EmptyState, LoadingSpinner, StatusBanner } from '../Feedback';

describe('Feedback components', () => {
  it('renders LoadingSpinner with accessible status role', () => {
    render(<LoadingSpinner label="Đang tải dữ liệu..." />);
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(screen.getAllByText('Đang tải dữ liệu...')[0]).toBeInTheDocument();
  });

  it('renders EmptyState with title, description, and action button', async () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="Không tìm thấy mục nào"
        description="Vui lòng thử điều chỉnh lại tiêu chí tìm kiếm của bạn."
        actionLabel="Đặt lại tìm kiếm"
        onAction={handleAction}
      />
    );

    expect(screen.getByText('Không tìm thấy mục nào')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng thử điều chỉnh lại tiêu chí tìm kiếm của bạn.')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: /đặt lại tìm kiếm/i });
    await userEvent.click(button);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('renders ErrorAlert with retry button and triggers callback', async () => {
    const handleRetry = vi.fn();
    render(
      <ErrorAlert
        title="Kết nối thất bại"
        message="Máy chủ dịch vụ không phản hồi"
        onRetry={handleRetry}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Kết nối thất bại')).toBeInTheDocument();
    expect(screen.getByText('Máy chủ dịch vụ không phản hồi')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /thử lại/i });
    await userEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('renders StatusBanner with message', () => {
    render(<StatusBanner type="warning" message="Bảo trì theo lịch trình tối nay" />);
    expect(screen.getByText('Bảo trì theo lịch trình tối nay')).toBeInTheDocument();
  });
});
