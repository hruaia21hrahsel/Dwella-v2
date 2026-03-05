import { ExpenseCategory } from './types';

interface CategoryMeta {
  value: ExpenseCategory;
  label: string;
  icon: string;
  color: string;
}

export const EXPENSE_CATEGORIES: CategoryMeta[] = [
  { value: 'repairs',     label: 'Repairs',     icon: 'wrench',          color: '#EF4444' },
  { value: 'insurance',   label: 'Insurance',   icon: 'shield-check',    color: '#3B82F6' },
  { value: 'rates',       label: 'Rates',       icon: 'bank',            color: '#8B5CF6' },
  { value: 'utilities',   label: 'Utilities',   icon: 'lightning-bolt',  color: '#F59E0B' },
  { value: 'maintenance', label: 'Maintenance', icon: 'hammer',          color: '#10B981' },
  { value: 'cleaning',    label: 'Cleaning',    icon: 'broom',           color: '#06B6D4' },
  { value: 'management',  label: 'Management',  icon: 'account-tie',     color: '#6366F1' },
  { value: 'other',       label: 'Other',       icon: 'dots-horizontal', color: '#94A3B8' },
];

function getMeta(category: ExpenseCategory): CategoryMeta {
  return EXPENSE_CATEGORIES.find((c) => c.value === category) ?? EXPENSE_CATEGORIES[7];
}

export function getCategoryLabel(category: ExpenseCategory): string {
  return getMeta(category).label;
}

export function getCategoryIcon(category: ExpenseCategory): string {
  return getMeta(category).icon;
}

export function getCategoryColor(category: ExpenseCategory): string {
  return getMeta(category).color;
}
