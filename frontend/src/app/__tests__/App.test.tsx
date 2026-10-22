import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';

describe('App root component', () => {
  it('renders application navbar brand and Vietnamese headline', () => {
    render(<App />);

    expect(screen.getAllByText('ShareLoop')[0]).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /ShareLoop/i })).toBeInTheDocument();
    expect(screen.getByText(/cộng đồng sẻ chia đồ dùng bền vững/i)).toBeInTheDocument();
  });

  it('renders all three core marketplace activity types in Vietnamese', () => {
    render(<App />);

    expect(screen.getByText('Cho tặng miễn phí')).toBeInTheDocument();
    expect(screen.getByText('Mua bán & Trao đổi đồ cũ')).toBeInTheDocument();
    expect(screen.getByText('Tìm kiếm đồ cần thiết')).toBeInTheDocument();
  });

  it('renders footer with copyright', () => {
    render(<App />);

    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(`© ${year} ShareLoop Platform`, 'i'))).toBeInTheDocument();
  });
});
