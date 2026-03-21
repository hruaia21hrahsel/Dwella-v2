import * as Crypto from 'expo-crypto';
import { MaintenancePriority, MaintenanceStatus } from './types';

// Re-export types for downstream consumers
export type { MaintenanceStatus, MaintenancePriority };

// ── Status metadata ──────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  open:         'Open',
  acknowledged: 'Acknowledged',
  in_progress:  'In Progress',
  resolved:     'Resolved',
  closed:       'Closed',
};

export const STATUS_COLORS: Record<MaintenanceStatus, string> = {
  open:         '#94A3B8',
  acknowledged: '#3B82F6',
  in_progress:  '#F59E0B',
  resolved:     '#10B981',
  closed:       '#0D9488',
};

export const STATUS_ICONS: Record<MaintenanceStatus, string> = {
  open:         'clock-outline',
  acknowledged: 'eye-outline',
  in_progress:  'hammer-wrench',
  resolved:     'check-circle-outline',
  closed:       'archive-outline',
};

// ── Status transition map ────────────────────────────────────────────────────

/**
 * Maps each status to the next valid status in the workflow.
 * `closed` has no next status (terminal state).
 */
export const NEXT_STATUS: Partial<Record<MaintenanceStatus, MaintenanceStatus>> = {
  open:         'acknowledged',
  acknowledged: 'in_progress',
  in_progress:  'resolved',
  resolved:     'closed',
};

/**
 * Human-readable action label for the next-status button.
 */
export const NEXT_STATUS_LABEL: Partial<Record<MaintenanceStatus, string>> = {
  open:         'Acknowledge',
  acknowledged: 'Start Work',
  in_progress:  'Mark Resolved',
  resolved:     'Close',
};

// ── Priority metadata ────────────────────────────────────────────────────────

export const PRIORITY_LABELS: Record<MaintenancePriority, string> = {
  low:    'Low',
  normal: 'Normal',
  urgent: 'Urgent',
};

export const PRIORITY_COLORS: Record<MaintenancePriority, string> = {
  low:    '#94A3B8',
  normal: '#3B82F6',
  urgent: '#EF4444',
};

export const PRIORITY_ICONS: Record<MaintenancePriority, string> = {
  low:    'chevron-down-circle-outline',
  normal: 'minus-circle-outline',
  urgent: 'alert-circle-outline',
};

// ── Convenience arrays ───────────────────────────────────────────────────────

export const ALL_STATUSES: MaintenanceStatus[] = [
  'open',
  'acknowledged',
  'in_progress',
  'resolved',
  'closed',
];

export const ALL_PRIORITIES: MaintenancePriority[] = ['low', 'normal', 'urgent'];

// ── Storage path helper ──────────────────────────────────────────────────────

/**
 * Returns the storage path for a maintenance photo inside the
 * maintenance-photos bucket.
 *
 * Path structure: {propertyId}/{requestId}/{uuid}.{ext}
 *
 * This mirrors getDocumentStoragePath() in lib/documents.ts.
 */
export function getMaintenancePhotoPath(
  propertyId: string,
  requestId: string,
  ext: string,
): string {
  const uuid = Crypto.randomUUID();
  return `${propertyId}/${requestId}/${uuid}.${ext}`;
}

// ── Expense description helper ───────────────────────────────────────────────

/**
 * Returns a formatted expense description when linking an expense to a
 * maintenance request (per D-16: auto-populate description as "Repair: {title}").
 */
export function getExpenseDescription(title: string): string {
  return `Repair: ${title}`;
}
