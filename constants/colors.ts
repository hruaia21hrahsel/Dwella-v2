export const Colors = {
  // Brand
  primary: '#4F46E5',
  primaryLight: '#818CF8',
  primaryDark: '#3730A3',
  primarySoft: '#EEF2FF',
  primaryMid: '#C7D2FE',

  // Status
  statusPending: '#94A3B8',
  statusPartial: '#F59E0B',
  statusPaid: '#3B82F6',
  statusConfirmed: '#10B981',
  statusOverdue: '#EF4444',

  // Status soft backgrounds
  statusPendingSoft: '#F1F5F9',
  statusPartialSoft: '#FEF3C7',
  statusPaidSoft: '#DBEAFE',
  statusConfirmedSoft: '#D1FAE5',
  statusOverdueSoft: '#FEE2E2',

  // Neutral
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  divider: '#F1F5F9',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textDisabled: '#CBD5E1',
  textOnPrimary: '#FFFFFF',
  textOnGradient: '#FFFFFF',
  textOnGradientMuted: 'rgba(255,255,255,0.75)',

  // Gradient pairs
  gradientHero: ['#4F46E5', '#7C3AED'] as string[],
  gradientHeroSubtle: ['#EEF2FF', '#F5F3FF'] as string[],

  // Functional
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
} as const;

export type ColorKey = keyof typeof Colors;

export const Shadows = {
  sm: {
    shadowColor: '#1E1B4B',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#1E1B4B',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 6,
  },
  hero: {
    shadowColor: '#3730A3',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 12,
  },
};
