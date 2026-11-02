import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DistributionBars } from '../components/DistributionBars';

describe('DistributionBars', () => {
  it('keeps the accessible list limited to listitem children', () => {
    render(
      <DistributionBars
        ariaLabel="Phân bố thử nghiệm"
        items={[
          { key: 'A', label: 'Hạng mục A', value: 2, color: '#059669' },
          { key: 'B', label: 'Hạng mục B', value: 1, color: '#0ea5e9' },
        ]}
      />
    );

    const list = screen.getByRole('list', { name: 'Phân bố thử nghiệm' });
    expect(list.children).toHaveLength(2);
    Array.from(list.children).forEach((child) => {
      expect(child).toHaveAttribute('role', 'listitem');
    });

    expect(
      screen.getByRole('table', { name: 'Phân bố thử nghiệm' })
    ).toBeInTheDocument();
  });

  it('renders no listitems and an explicit empty label when there is no data', () => {
    render(
      <DistributionBars
        ariaLabel="Phân bố rỗng"
        items={[]}
        emptyLabel="Chưa có dữ liệu trong kỳ."
      />
    );

    expect(screen.getByRole('list', { name: 'Phân bố rỗng' }).children).toHaveLength(0);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByText('Chưa có dữ liệu trong kỳ.')).toBeInTheDocument();
  });
});
