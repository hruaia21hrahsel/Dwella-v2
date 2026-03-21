/**
 * Unit tests for lib/maintenance.ts pure helpers.
 * All tests are pure — no Supabase or network calls.
 */

import {
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_ICONS,
  NEXT_STATUS,
  NEXT_STATUS_LABEL,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  PRIORITY_ICONS,
  ALL_STATUSES,
  ALL_PRIORITIES,
  getMaintenancePhotoPath,
  getExpenseDescription,
} from '../lib/maintenance';

describe('getMaintenancePhotoPath', () => {
  it('returns string matching {propId}/{reqId}/{uuid}.{ext} pattern', () => {
    const result = getMaintenancePhotoPath('prop-1', 'req-1', 'jpg');
    // expo-crypto mock returns fixed UUID: 00000000-1111-4222-8333-444444444444
    expect(result).toBe('prop-1/req-1/00000000-1111-4222-8333-444444444444.jpg');
  });
});

describe('STATUS_LABELS', () => {
  it('has entries for all 5 statuses', () => {
    expect(STATUS_LABELS['open']).toBeDefined();
    expect(STATUS_LABELS['acknowledged']).toBeDefined();
    expect(STATUS_LABELS['in_progress']).toBeDefined();
    expect(STATUS_LABELS['resolved']).toBeDefined();
    expect(STATUS_LABELS['closed']).toBeDefined();
  });

  it('returns correct labels', () => {
    expect(STATUS_LABELS['open']).toBe('Open');
    expect(STATUS_LABELS['acknowledged']).toBe('Acknowledged');
    expect(STATUS_LABELS['in_progress']).toBe('In Progress');
    expect(STATUS_LABELS['resolved']).toBe('Resolved');
    expect(STATUS_LABELS['closed']).toBe('Closed');
  });
});

describe('STATUS_COLORS', () => {
  it('has entries for all 5 statuses with correct hex values', () => {
    expect(STATUS_COLORS['open']).toBe('#94A3B8');
    expect(STATUS_COLORS['acknowledged']).toBe('#3B82F6');
    expect(STATUS_COLORS['in_progress']).toBe('#F59E0B');
    expect(STATUS_COLORS['resolved']).toBe('#10B981');
    expect(STATUS_COLORS['closed']).toBe('#0D9488');
  });
});

describe('NEXT_STATUS', () => {
  it('maps statuses in the correct transition chain', () => {
    expect(NEXT_STATUS['open']).toBe('acknowledged');
    expect(NEXT_STATUS['acknowledged']).toBe('in_progress');
    expect(NEXT_STATUS['in_progress']).toBe('resolved');
    expect(NEXT_STATUS['resolved']).toBe('closed');
  });

  it('does not have a next status for closed', () => {
    expect(NEXT_STATUS['closed']).toBeUndefined();
  });
});

describe('NEXT_STATUS_LABEL', () => {
  it('maps statuses to correct action labels', () => {
    expect(NEXT_STATUS_LABEL['open']).toBe('Acknowledge');
    expect(NEXT_STATUS_LABEL['acknowledged']).toBe('Start Work');
    expect(NEXT_STATUS_LABEL['in_progress']).toBe('Mark Resolved');
    expect(NEXT_STATUS_LABEL['resolved']).toBe('Close');
  });

  it('does not have a label for closed', () => {
    expect(NEXT_STATUS_LABEL['closed']).toBeUndefined();
  });
});

describe('PRIORITY_LABELS', () => {
  it('has entries for low, normal, urgent', () => {
    expect(PRIORITY_LABELS['low']).toBe('Low');
    expect(PRIORITY_LABELS['normal']).toBe('Normal');
    expect(PRIORITY_LABELS['urgent']).toBe('Urgent');
  });
});

describe('PRIORITY_COLORS', () => {
  it('has entries for low (#94A3B8), normal (#3B82F6), urgent (#EF4444)', () => {
    expect(PRIORITY_COLORS['low']).toBe('#94A3B8');
    expect(PRIORITY_COLORS['normal']).toBe('#3B82F6');
    expect(PRIORITY_COLORS['urgent']).toBe('#EF4444');
  });
});

describe('getExpenseDescription', () => {
  it('returns "Repair: {title}" format', () => {
    expect(getExpenseDescription('Leaking tap')).toBe('Repair: Leaking tap');
  });

  it('handles various titles correctly', () => {
    expect(getExpenseDescription('Broken window')).toBe('Repair: Broken window');
    expect(getExpenseDescription('')).toBe('Repair: ');
  });
});

describe('STATUS_ICONS', () => {
  it('has entries for all 5 statuses', () => {
    expect(STATUS_ICONS['open']).toBeDefined();
    expect(STATUS_ICONS['acknowledged']).toBeDefined();
    expect(STATUS_ICONS['in_progress']).toBeDefined();
    expect(STATUS_ICONS['resolved']).toBeDefined();
    expect(STATUS_ICONS['closed']).toBeDefined();
  });

  it('returns correct icon names', () => {
    expect(STATUS_ICONS['open']).toBe('clock-outline');
    expect(STATUS_ICONS['acknowledged']).toBe('eye-outline');
    expect(STATUS_ICONS['in_progress']).toBe('hammer-wrench');
    expect(STATUS_ICONS['resolved']).toBe('check-circle-outline');
    expect(STATUS_ICONS['closed']).toBe('archive-outline');
  });
});

describe('ALL_STATUSES and ALL_PRIORITIES arrays', () => {
  it('ALL_STATUSES contains all 5 statuses', () => {
    expect(ALL_STATUSES).toHaveLength(5);
    expect(ALL_STATUSES).toContain('open');
    expect(ALL_STATUSES).toContain('acknowledged');
    expect(ALL_STATUSES).toContain('in_progress');
    expect(ALL_STATUSES).toContain('resolved');
    expect(ALL_STATUSES).toContain('closed');
  });

  it('ALL_PRIORITIES contains all 3 priorities', () => {
    expect(ALL_PRIORITIES).toHaveLength(3);
    expect(ALL_PRIORITIES).toContain('low');
    expect(ALL_PRIORITIES).toContain('normal');
    expect(ALL_PRIORITIES).toContain('urgent');
  });
});
