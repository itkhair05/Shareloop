import { describe, it, expect } from 'vitest';
import { getInitials } from '../avatar';

describe('getInitials', () => {
  it('extracts initials from Vietnamese full names', () => {
    expect(getInitials('Nguyễn Văn An')).toBe('NA');
    expect(getInitials('Trần Thị Bích Ngọc')).toBe('TN');
    expect(getInitials('Phạm Hoàng')).toBe('PH');
  });

  it('handles two-word names', () => {
    expect(getInitials('Trần Minh')).toBe('TM');
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('handles one-word names', () => {
    expect(getInitials('Khải')).toBe('K');
    expect(getInitials('Admin')).toBe('A');
  });

  it('handles multiple consecutive spaces', () => {
    expect(getInitials('Nguyễn   Văn   An')).toBe('NA');
    expect(getInitials('  Trần    Minh  ')).toBe('TM');
  });

  it('handles leading and trailing whitespace', () => {
    expect(getInitials('   Nguyễn Văn An   ')).toBe('NA');
    expect(getInitials('  Khải  ')).toBe('K');
  });

  it('returns null for empty string or whitespace-only names', () => {
    expect(getInitials('')).toBeNull();
    expect(getInitials('   ')).toBeNull();
    expect(getInitials('\t\n ')).toBeNull();
  });

  it('returns null for null or undefined name', () => {
    expect(getInitials(null)).toBeNull();
    expect(getInitials(undefined)).toBeNull();
  });

  it('handles Unicode characters and lowercase inputs correctly', () => {
    expect(getInitials('đặng văn lâm')).toBe('ĐL');
    expect(getInitials('ân nguyễn')).toBe('ÂN');
    expect(getInitials('lê ánh')).toBe('LÁ');
    expect(getInitials('Éléonore Dupuis')).toBe('ÉD');
  });
});
