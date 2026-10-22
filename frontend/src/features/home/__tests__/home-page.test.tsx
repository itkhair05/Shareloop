import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { HomePage } from '../HomePage';
import { renderWithProviders } from '@/test/test-utils';

describe('HomePage - Final CTA & Visibility', () => {
  it('renders the Final CTA section with high-contrast primary button using !text-emerald-900', () => {
    renderWithProviders(<HomePage />, { initialEntries: ['/'] });

    // Locate the Final CTA section
    const finalCtaHeading = screen.getByRole('heading', {
      name: /sẵn sàng kết nối và sẻ chia cùng hàng xóm của bạn\?/i,
    });
    const finalCtaSection = finalCtaHeading.closest('section');
    expect(finalCtaSection).toBeInTheDocument();

    // Find the primary button inside Final CTA section
    const primaryCta = within(finalCtaSection!).getByRole('button', { name: /khám phá đồ dùng/i });
    expect(primaryCta).toBeInTheDocument();

    // Verify critical contrast classes
    expect(primaryCta.className).toContain('bg-white');
    expect(primaryCta.className).toContain('!text-emerald-900');
    expect(primaryCta.className).toContain('hover:bg-gray-100');

    // Verify parent Link targets /explore
    const primaryLink = primaryCta.closest('a');
    expect(primaryLink).toHaveAttribute('href', '/explore');
  });

  it('renders the Final CTA secondary button with readable white text and border', () => {
    renderWithProviders(<HomePage />, { initialEntries: ['/'] });

    const finalCtaHeading = screen.getByRole('heading', {
      name: /sẵn sàng kết nối và sẻ chia cùng hàng xóm của bạn\?/i,
    });
    const finalCtaSection = finalCtaHeading.closest('section');
    expect(finalCtaSection).toBeInTheDocument();

    const secondaryCta = within(finalCtaSection!).getByRole('button', {
      name: /đăng ký tài khoản miễn phí/i,
    });
    expect(secondaryCta).toBeInTheDocument();

    expect(secondaryCta.className).toContain('border-white');
    expect(secondaryCta.className).toContain('text-white');
    expect(secondaryCta.className).toContain('hover:bg-white/10');

    const secondaryLink = secondaryCta.closest('a');
    expect(secondaryLink).toHaveAttribute('href', '/register');
  });
});
