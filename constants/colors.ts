export const Colors = {
  // Brand — Slate Navy
  primary: '#1E293B',
  primaryLight: '#E2E8F0',
  primaryDark: '#0F172A',
  primarySoft: '#F1F5F9',
  primaryMid: '#64748B',

  // Status
  statusPending: '#94A3B8',
  statusPartial: '#F59E0B',
  statusPaid: '#3B82F6',
  statusConfirmed: '#22C55E',
  statusOverdue: '#EF4444',

  // Status soft backgrounds
  statusPendingSoft: '#F1F5F9',
  statusPartialSoft: '#FEF3C7',
  statusPaidSoft: '#DBEAFE',
  statusConfirmedSoft: '#DCFCE7',
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
  gradientHero: ['#1E293B', '#64748B'] as string[],
  gradientHeroSubtle: ['#F1F5F9', '#E2E8F0'] as string[],

  // Functional
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
} as const;

export type ColorKey = keyof typeof Colors;

export const Shadows = {
  sm: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 6,
  },
  hero: {
    shadowColor: '#1E293B',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 12,
  },
};
