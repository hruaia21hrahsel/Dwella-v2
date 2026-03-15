import {
  formatCurrency,
  formatDate,
  getMonthName,
  getCurrentMonthYear,
  getOrdinal,
  adjustPropertyColor,
} from '@/lib/utils';

describe('formatCurrency', () => {
  it('formats positive amounts in INR', () => {
    const result = formatCurrency(15000);
    expect(result).toContain('15,000');
  });

  it('formats zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });

  it('rounds to whole numbers', () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain('1,235');
  });
});

describe('formatDate', () => {
  it('formats ISO date string', () => {
    const result = formatDate('2025-06-15T10:00:00Z');
    expect(result).toMatch(/15/);
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/2025/);
  });
});

describe('getMonthName', () => {
  it('returns correct month names', () => {
    expect(getMonthName(1)).toBe('January');
    expect(getMonthName(6)).toBe('June');
    expect(getMonthName(12)).toBe('December');
  });

  it('returns empty string for out-of-range', () => {
    expect(getMonthName(0)).toBe('');
    expect(getMonthName(13)).toBe('');
  });
});

describe('getCurrentMonthYear', () => {
  it('returns current month and year', () => {
    const { month, year } = getCurrentMonthYear();
    const now = new Date();
    expect(month).toBe(now.getMonth() + 1);
    expect(year).toBe(now.getFullYear());
  });
});

describe('getOrdinal', () => {
  it('handles 1st, 2nd, 3rd', () => {
    expect(getOrdinal(1)).toBe('1st');
    expect(getOrdinal(2)).toBe('2nd');
    expect(getOrdinal(3)).toBe('3rd');
  });

  it('handles teens', () => {
    expect(getOrdinal(11)).toBe('11th');
    expect(getOrdinal(12)).toBe('12th');
    expect(getOrdinal(13)).toBe('13th');
  });

  it('handles regular numbers', () => {
    expect(getOrdinal(4)).toBe('4th');
    expect(getOrdinal(21)).toBe('21st');
    expect(getOrdinal(22)).toBe('22nd');
    expect(getOrdinal(100)).toBe('100th');
  });
});

describe('adjustPropertyColor', () => {
  it('returns color as-is in light mode', () => {
    expect(adjustPropertyColor('#003366', false)).toBe('#003366');
  });

  it('lightens dark colors in dark mode', () => {
    const result = adjustPropertyColor('#003366', true);
    expect(result).not.toBe('#003366');
    // Lightened color should have higher RGB values
    const r = parseInt(result.slice(1, 3), 16);
    const g = parseInt(result.slice(3, 5), 16);
    const b = parseInt(result.slice(5, 7), 16);
    expect(r).toBeGreaterThan(0x00);
    expect(g).toBeGreaterThan(0x33);
    expect(b).toBeGreaterThan(0x66);
  });

  it('keeps bright colors as-is in dark mode', () => {
    expect(adjustPropertyColor('#FFCC00', true)).toBe('#FFCC00');
  });

  it('handles non-6-char hex gracefully', () => {
    expect(adjustPropertyColor('#FFF', true)).toBe('#FFF');
  });
});
