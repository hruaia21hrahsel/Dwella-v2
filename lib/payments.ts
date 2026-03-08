import { supabase } from './supabase';
import { PaymentStatus } from './types';
import { Colors } from '@/constants/colors';

export function getStatusColor(status: PaymentStatus): string {
  switch (status) {
    case 'pending': return Colors.statusPending;
    case 'partial': return Colors.statusPartial;
    case 'paid': return Colors.statusPaid;
    case 'confirmed': return Colors.statusConfirmed;
    case 'overdue': return Colors.statusOverdue;
  }
}

export function getStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case 'pending': return 'Pending';
    case 'partial': return 'Partial';
    case 'paid': return 'Paid';
    case 'confirmed': return 'Confirmed';
    case 'overdue': return 'Overdue';
  }
}

export function canMarkAsPaid(status: PaymentStatus): boolean {
  return status === 'pending' || status === 'partial' || status === 'overdue';
}

export function canConfirm(status: PaymentStatus): boolean {
  return status === 'paid';
}

export function getDueDate(year: number, month: number, dueDay: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(dueDay, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getProofStoragePath(
  propertyId: string,
  tenantId: string,
  year: number,
  month: number,
): string {
  return `${propertyId}/${tenantId}/${year}-${String(month).padStart(2, '0')}.jpg`;
}

export async function getProofSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from('payment-proofs')
    .createSignedUrl(path, 3600); // 1-hour expiry
  return data?.signedUrl ?? null;
}
