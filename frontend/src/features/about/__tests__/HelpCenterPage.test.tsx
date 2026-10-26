import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AboutPage } from '../AboutPage';
import { renderWithProviders } from '@/test/test-utils';

describe('Help Center Page (Trung tâm trợ giúp)', () => {
  beforeEach(() => {
    document.title = 'ShareLoop';
  });

  it('renders Hero section with main heading, description, and search input', () => {
    renderWithProviders(<AboutPage />);

    expect(screen.getByRole('heading', { level: 1, name: /trung tâm trợ giúp/i })).toBeInTheDocument();
    expect(
      screen.getByText(/tìm hiểu cách đăng tin, gửi yêu cầu trao đổi/i)
    ).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/bạn đang cần tìm câu trả lời nào/i);
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('type', 'search');
    expect(document.title).toBe('Trung tâm trợ giúp | ShareLoop');
  });

  it('renders FAQ section and all 6 category filter buttons', () => {
    renderWithProviders(<AboutPage />);

    expect(screen.getByRole('heading', { level: 2, name: /câu hỏi thường gặp/i })).toBeInTheDocument();

    const categories = [
      'Tất cả',
      'Tài khoản & hồ sơ',
      'Tin đăng',
      'Yêu cầu trao đổi',
      'Nhắn tin & giao dịch',
      'Đánh giá & uy tín',
      'An toàn cộng đồng',
    ];

    categories.forEach((cat) => {
      expect(screen.getByRole('button', { name: new RegExp(`^${cat}$`, 'i') })).toBeInTheDocument();
    });
  });

  it('supports accordion toggle with aria-expanded and keyboard accessibility', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AboutPage />);

    // First FAQ item is expanded by default
    const firstFaqBtn = screen.getByRole('button', {
      name: /làm cách nào để cập nhật thông tin cá nhân trên shareloop/i,
    });
    expect(firstFaqBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/bạn hãy đăng nhập và truy cập trang hồ sơ cá nhân/i)).toBeInTheDocument();

    // Click to collapse
    await user.click(firstFaqBtn);
    expect(firstFaqBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/bạn hãy đăng nhập và truy cập trang hồ sơ cá nhân/i)).not.toBeInTheDocument();

    // Click another FAQ item to expand
    const secondFaqBtn = screen.getByRole('button', {
      name: /hồ sơ công khai của tôi hiển thị những thông tin gì/i,
    });
    expect(secondFaqBtn).toHaveAttribute('aria-expanded', 'false');

    await user.click(secondFaqBtn);
    expect(secondFaqBtn).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText(/khi thành viên khác xem trang cá nhân công khai của bạn/i)
    ).toBeInTheDocument();
  });

  it('filters FAQs in real time based on search query', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AboutPage />);

    const searchInput = screen.getByPlaceholderText(/bạn đang cần tìm câu trả lời nào/i);

    // Search for "GIVEAWAY"
    await user.type(searchInput, 'GIVEAWAY');

    expect(
      screen.getByText(/shareloop hỗ trợ những hình thức đăng tin nào/i)
    ).toBeInTheDocument();
    // Non-matching question should not be visible
    expect(
      screen.queryByText(/làm cách nào để cập nhật thông tin cá nhân trên shareloop/i)
    ).not.toBeInTheDocument();
  });

  it('renders helpful empty state when no FAQs match search and allows reset', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AboutPage />);

    const searchInput = screen.getByPlaceholderText(/bạn đang cần tìm câu trả lời nào/i);

    await user.type(searchInput, 'nonexistentquery123');

    expect(screen.getByText(/không tìm thấy câu hỏi phù hợp/i)).toBeInTheDocument();
    expect(
      screen.getByText(/không có câu trả lời nào khớp với từ khóa/i)
    ).toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: /đặt lại bộ lọc/i });
    expect(resetBtn).toBeInTheDocument();

    await user.click(resetBtn);

    expect(searchInput).toHaveValue('');
    expect(screen.queryByText(/không tìm thấy câu hỏi phù hợp/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/làm cách nào để cập nhật thông tin cá nhân trên shareloop/i)
    ).toBeInTheDocument();
  });

  it('filters FAQs by clicking category badges', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AboutPage />);

    const safetyCategoryBtn = screen.getByRole('button', { name: /^an toàn cộng đồng$/i });
    await user.click(safetyCategoryBtn);

    expect(
      screen.getByText(/tôi nên chuẩn bị gì khi hẹn gặp nhận đồ trực tiếp/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/shareloop có tính năng báo cáo hoặc chặn người dùng khả nghi không/i)
    ).toBeInTheDocument();

    // Questions from other categories should be hidden
    expect(
      screen.queryByText(/làm cách nào để cập nhật thông tin cá nhân trên shareloop/i)
    ).not.toBeInTheDocument();
  });

  it('renders How-To Guides section with 4 structured steps', () => {
    renderWithProviders(<AboutPage />);

    expect(
      screen.getByRole('heading', { level: 2, name: /quy trình trao đổi trên shareloop/i })
    ).toBeInTheDocument();

    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('Đăng tin hoặc Tìm kiếm')).toBeInTheDocument();

    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('Gửi & Tiếp nhận yêu cầu')).toBeInTheDocument();

    expect(screen.getByText('03')).toBeInTheDocument();
    expect(screen.getByText('Nhắn tin & Hẹn gặp nhận đồ')).toBeInTheDocument();

    expect(screen.getByText('04')).toBeInTheDocument();
    expect(screen.getByText('Đánh giá & Xây dựng uy tín')).toBeInTheDocument();
  });

  it('renders Community Guidelines & Safety section with reporting limitations note', () => {
    renderWithProviders(<AboutPage />);

    expect(
      screen.getByRole('heading', { level: 2, name: /quy tắc cộng đồng & an toàn giao dịch/i })
    ).toBeInTheDocument();

    expect(screen.getByText('Giao tiếp văn minh & Đúng hẹn')).toBeInTheDocument();
    expect(screen.getByText('Mô tả trung thực & Ảnh chụp rõ ràng')).toBeInTheDocument();
    expect(screen.getByText('Gặp gỡ an toàn tại nơi công cộng')).toBeInTheDocument();
    expect(screen.getByText('Cảnh giác lừa đảo & Không chuyển cọc')).toBeInTheDocument();

    // Critical honest safety guidance
    expect(screen.getByText(/lưu ý quan trọng về an toàn:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/hệ thống shareloop hiện chưa có tính năng tự động chặn tài khoản/i)
    ).toBeInTheDocument();
  });

  it('renders Useful Navigation cards with valid links to key app pages', () => {
    renderWithProviders(<AboutPage />);

    expect(
      screen.getByRole('heading', { level: 2, name: /bạn đã sẵn sàng tham gia shareloop\?/i })
    ).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /khám phá đồ dùng/i })).toHaveAttribute(
      'href',
      '/explore'
    );
    expect(screen.getByRole('link', { name: /đăng món đồ mới/i })).toHaveAttribute(
      'href',
      '/listings/new'
    );
    expect(screen.getByRole('link', { name: /hộp thư tin nhắn/i })).toHaveAttribute(
      'href',
      '/messages'
    );
    expect(screen.getByRole('link', { name: /hồ sơ của bạn/i })).toHaveAttribute(
      'href',
      '/profile'
    );
  });
});
