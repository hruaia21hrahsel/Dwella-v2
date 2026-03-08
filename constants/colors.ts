export const Colors = {
  // Brand — NoBroker Teal
  primary: '#00BFA5',
  primaryLight: '#CCFBF1',
  primaryDark: '#009688',
  primarySoft: '#F0FDFA',
  primaryMid: '#5EEAD4',

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
  gradientHero: ['#00BFA5', '#5EEAD4'] as string[],
  gradientHeroSubtle: ['#F0FDFA', '#CCFBF1'] as string[],

  // Functional
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
} as const;

export type ColorKey = keyof typeof Colors;

export const Shadows = {
  sm: {
    shadowColor: '#009688',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#009688',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 6,
  },
  hero: {
    shadowColor: '#00BFA5',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 12,
  },
};
