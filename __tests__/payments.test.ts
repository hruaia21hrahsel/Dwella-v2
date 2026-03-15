import {
  getStatusColor,
  getStatusLabel,
  canMarkAsPaid,
  canConfirm,
  getDueDate,
  getProofStoragePath,
} from '@/lib/payments';
import { PaymentStatus } from '@/lib/types';

describe('getStatusColor', () => {
  it('returns a color string for every status', () => {
    const statuses: PaymentStatus[] = ['pending', 'partial', 'paid', 'confirmed', 'overdue'];
    for (const s of statuses) {
      const color = getStatusColor(s);
      expect(color).toBeTruthy();
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('returns distinct colors for different statuses', () => {
    const colors = new Set([
      getStatusColor('pending'),
      getStatusColor('paid'),
      getStatusColor('confirmed'),
      getStatusColor('overdue'),
    ]);
    expect(colors.size).toBe(4);
  });
});

describe('getStatusLabel', () => {
  it('returns human-readable labels', () => {
    expect(getStatusLabel('pending')).toBe('Pending');
    expect(getStatusLabel('partial')).toBe('Partial');
    expect(getStatusLabel('paid')).toBe('Paid');
    expect(getStatusLabel('confirmed')).toBe('Confirmed');
    expect(getStatusLabel('overdue')).toBe('Overdue');
  });
});

describe('canMarkAsPaid', () => {
  it('allows marking pending, partial, overdue as paid', () => {
    expect(canMarkAsPaid('pending')).toBe(true);
    expect(canMarkAsPaid('partial')).toBe(true);
    expect(canMarkAsPaid('overdue')).toBe(true);
  });

  it('disallows marking paid or confirmed', () => {
    expect(canMarkAsPaid('paid')).toBe(false);
    expect(canMarkAsPaid('confirmed')).toBe(false);
  });
});

describe('canConfirm', () => {
  it('only allows confirming paid status', () => {
    expect(canConfirm('paid')).toBe(true);
    expect(canConfirm('pending')).toBe(false);
    expect(canConfirm('partial')).toBe(false);
    expect(canConfirm('confirmed')).toBe(false);
    expect(canConfirm('overdue')).toBe(false);
  });
});

describe('getDueDate', () => {
  it('returns correct date string', () => {
    expect(getDueDate(2025, 6, 15)).toBe('2025-06-15');
    expect(getDueDate(2025, 1, 1)).toBe('2025-01-01');
  });

  it('clamps to last day of month', () => {
    // February 2025 has 28 days
    expect(getDueDate(2025, 2, 31)).toBe('2025-02-28');
    // February 2024 (leap year) has 29 days
    expect(getDueDate(2024, 2, 31)).toBe('2024-02-29');
  });

  it('handles month boundaries', () => {
    // April has 30 days
    expect(getDueDate(2025, 4, 30)).toBe('2025-04-30');
    expect(getDueDate(2025, 4, 31)).toBe('2025-04-30');
  });
});

describe('getProofStoragePath', () => {
  it('returns correct path format', () => {
    const path = getProofStoragePath('prop-123', 'tenant-456', 2025, 6);
    expect(path).toBe('prop-123/tenant-456/2025-06.jpg');
  });

  it('zero-pads single-digit months', () => {
    const path = getProofStoragePath('p', 't', 2025, 1);
    expect(path).toBe('p/t/2025-01.jpg');
  });
});
