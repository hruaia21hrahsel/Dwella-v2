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

export async function ensurePaymentRows(
  tenantId: string,
  propertyId: string,
  monthlyRent: number,
  dueDay: number,
  leaseStart: string,
): Promise<void> {
  const startDate = new Date(leaseStart);
  const now = new Date();

  const { data: existing } = await supabase
    .from('payments')
    .select('month, year')
    .eq('tenant_id', tenantId);

  const existingSet = new Set(
    (existing ?? []).map((p) => `${p.year}-${p.month}`)
  );

  const rows: {
    tenant_id: string;
    property_id: string;
    month: number;
    year: number;
    amount_due: number;
    amount_paid: number;
    status: PaymentStatus;
    due_date: string;
  }[] = [];

  // Iterate from lease start to current month
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);

  while (cursor <= end) {
    const month = cursor.getMonth() + 1;
    const year = cursor.getFullYear();

    if (!existingSet.has(`${year}-${month}`)) {
      rows.push({
        tenant_id: tenantId,
        property_id: propertyId,
        month,
        year,
        amount_due: monthlyRent,
        amount_paid: 0,
        status: 'pending',
        due_date: getDueDate(year, month, dueDay),
      });
    }

    cursor.setMonth(cursor.getMonth() + 1);
  }

  if (rows.length > 0) {
    await supabase.from('payments').insert(rows);
  }
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
