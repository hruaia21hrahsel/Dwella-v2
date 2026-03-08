export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'confirmed' | 'overdue';
export type InviteStatus = 'pending' | 'accepted' | 'expired';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  telegram_chat_id: number | null;
  telegram_link_token: string | null;
  push_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  city: string;
  total_units: number;
  color: string | null;
  notes: string | null;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  property_id: string;
  user_id: string | null;
  flat_no: string;
  tenant_name: string;
  monthly_rent: number;
  security_deposit: number;
  due_day: number;
  lease_start: string;
  lease_end: string | null;
  invite_token: string;
  invite_status: InviteStatus;
  photo_url: string | null;
  notes: string | null;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  properties?: Property;
}

export interface Payment {
  id: string;
  tenant_id: string;
  property_id: string;
  amount_due: number;
  amount_paid: number;
  status: PaymentStatus;
  month: number;
  year: number;
  due_date: string;
  paid_at: string | null;
  confirmed_at: string | null;
  auto_confirmed: boolean;
  proof_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  tenant_id: string | null;
  payment_id: string | null;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export type ExpenseCategory =
  | 'repairs' | 'insurance' | 'rates' | 'utilities'
  | 'maintenance' | 'cleaning' | 'management' | 'other';

export interface Expense {
  id: string;
  property_id: string;
  user_id: string;
  amount: number;
  category: ExpenseCategory;
  description: string | null;
  expense_date: string;
  created_at: string;
  updated_at: string;
}

export interface BotConversation {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}
