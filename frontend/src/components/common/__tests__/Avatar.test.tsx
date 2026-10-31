import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Avatar, type AvatarSize } from '../Avatar';

describe('Avatar Component', () => {
  describe('Rendering Priority', () => {
    it('Priority 1: renders image when valid avatarUrl is provided', () => {
      render(
        <Avatar
          avatarUrl="/api/v1/files/avatars/user-123.jpg"
          name="Nguyễn Văn An"
        />
      );

      const img = screen.getByRole('img', { name: 'Nguyễn Văn An' });
      expect(img.tagName.toLowerCase()).toBe('img');
      expect(img).toHaveAttribute('src', 'http://localhost:8080/api/v1/files/avatars/user-123.jpg');
    });

    it('renders external HTTPS image URL (e.g. Google profile photo) directly', () => {
      const googlePhotoUrl = 'https://lh3.googleusercontent.com/a/ACg8ocK12345';
      render(
        <Avatar
          avatarUrl={googlePhotoUrl}
          name="Trần Minh"
        />
      );

      const img = screen.getByRole('img', { name: 'Trần Minh' });
      expect(img).toHaveAttribute('src', googlePhotoUrl);
    });

    it('Priority 2: renders initials when avatarUrl is missing and name is present', () => {
      render(<Avatar name="Nguyễn Văn An" />);

      expect(screen.queryByRole('img', { name: 'Nguyễn Văn An' })).not.toBeNull();
      expect(screen.getByText('NA')).toBeInTheDocument();
      // Should not contain an <img> element
      expect(document.querySelector('img')).toBeNull();
    });

    it('Priority 2: renders initials when avatarUrl is null', () => {
      render(<Avatar avatarUrl={null} name="Trần Minh" />);

      expect(screen.getByText('TM')).toBeInTheDocument();
      expect(document.querySelector('img')).toBeNull();
    });

    it('Priority 2: renders initials when avatarUrl is empty string', () => {
      render(<Avatar avatarUrl="" name="Khải" />);

      expect(screen.getByText('K')).toBeInTheDocument();
      expect(document.querySelector('img')).toBeNull();
    });

    it('Priority 3: renders default visual fallback icon when both avatarUrl and name are absent', () => {
      const { container } = render(<Avatar />);

      expect(document.querySelector('img')).toBeNull();
      // Lucide icon SVG should be rendered
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('Priority 3: renders default visual fallback when name is whitespace only', () => {
      const { container } = render(<Avatar name="    " />);

      expect(document.querySelector('img')).toBeNull();
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Image Error Handling', () => {
    it('displays initials fallback when image fails to load', () => {
      render(
        <Avatar
          avatarUrl="https://example.com/broken-avatar.jpg"
          name="Nguyễn Văn An"
        />
      );

      const img = screen.getByRole('img');
      expect(img.tagName.toLowerCase()).toBe('img');

      // Simulate image error event
      fireEvent.error(img);

      // Now the <img> should be replaced by initials
      expect(document.querySelector('img')).toBeNull();
      expect(screen.getByText('NA')).toBeInTheDocument();
    });

    it('displays default visual fallback when image fails to load and name is absent', () => {
      const { container } = render(
        <Avatar avatarUrl="https://example.com/broken-avatar.jpg" />
      );

      const img = screen.getByRole('img');
      fireEvent.error(img);

      expect(document.querySelector('img')).toBeNull();
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('resets image error state and renders new image when avatarUrl changes', () => {
      const { rerender } = render(
        <Avatar
          avatarUrl="https://example.com/broken-avatar.jpg"
          name="Nguyễn Văn An"
        />
      );

      // Trigger error
      const brokenImg = screen.getByRole('img');
      fireEvent.error(brokenImg);
      expect(screen.getByText('NA')).toBeInTheDocument();

      // Change avatarUrl to a new working URL
      rerender(
        <Avatar
          avatarUrl="https://example.com/new-avatar.jpg"
          name="Nguyễn Văn An"
        />
      );

      const newImg = screen.getByRole('img');
      expect(newImg.tagName.toLowerCase()).toBe('img');
      expect(newImg).toHaveAttribute('src', 'https://example.com/new-avatar.jpg');
      expect(screen.queryByText('NA')).toBeNull();
    });

    it('immediately displays fallback when avatarUrl is removed', () => {
      const { rerender } = render(
        <Avatar
          avatarUrl="https://example.com/avatar.jpg"
          name="Nguyễn Văn An"
        />
      );

      expect(document.querySelector('img')).not.toBeNull();

      // Remove avatarUrl
      rerender(<Avatar avatarUrl={null} name="Nguyễn Văn An" />);

      expect(document.querySelector('img')).toBeNull();
      expect(screen.getByText('NA')).toBeInTheDocument();
    });
  });

  describe('Accessibility & Labels', () => {
    it('uses custom alt prop when provided', () => {
      render(
        <Avatar
          avatarUrl="https://example.com/photo.jpg"
          name="Nguyễn Văn An"
          alt="Ảnh hồ sơ cá nhân của Nguyễn Văn An"
        />
      );

      expect(screen.getByRole('img', { name: 'Ảnh hồ sơ cá nhân của Nguyễn Văn An' })).toBeInTheDocument();
    });

    it('falls back to name when alt is not provided', () => {
      render(
        <Avatar
          avatarUrl="https://example.com/photo.jpg"
          name="Trần Minh"
        />
      );

      expect(screen.getByRole('img', { name: 'Trần Minh' })).toBeInTheDocument();
    });

    it('falls back to generic Vietnamese label when neither alt nor name is provided', () => {
      render(<Avatar />);

      expect(screen.getByRole('img', { name: 'Ảnh đại diện người dùng' })).toBeInTheDocument();
    });
  });

  describe('Size Variants & Styling', () => {
    const sizeMatrix: Array<{ size: AvatarSize; expectedClass: string }> = [
      { size: 'xs', expectedClass: 'w-6 h-6' },
      { size: 'sm', expectedClass: 'w-8 h-8' },
      { size: 'md', expectedClass: 'w-10 h-10' },
      { size: 'lg', expectedClass: 'w-12 h-12' },
      { size: 'xl', expectedClass: 'w-16 h-16' },
      { size: '2xl', expectedClass: 'w-24 h-24' },
    ];

    sizeMatrix.forEach(({ size, expectedClass }) => {
      it(`renders correct sizing class for size="${size}"`, () => {
        const { container } = render(<Avatar size={size} name="Test User" />);
        const avatarContainer = container.firstElementChild;
        expect(avatarContainer?.className).toContain(expectedClass);
      });
    });

    it('defaults to md size when size is omitted', () => {
      const { container } = render(<Avatar name="Test User" />);
      const avatarContainer = container.firstElementChild;
      expect(avatarContainer?.className).toContain('w-10 h-10');
    });

    it('merges custom className without removing default container styling', () => {
      const { container } = render(
        <Avatar name="Test User" className="border-emerald-500 shadow-md ring-2 ring-emerald-200" />
      );
      const avatarContainer = container.firstElementChild;
      expect(avatarContainer?.className).toContain('border-emerald-500');
      expect(avatarContainer?.className).toContain('shadow-md');
      expect(avatarContainer?.className).toContain('rounded-full');
    });
  });
});
