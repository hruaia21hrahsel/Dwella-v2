import { LightTheme } from './theme';

// Backward compatibility — static light-theme colors for files that haven't migrated yet.
// New code should use `useTheme()` from `@/lib/theme-context` instead.
export const Colors = {
  // Brand — NoBroker Teal
  primary: LightTheme.colors.primary,
  primaryLight: LightTheme.colors.primaryLight,
  primaryDark: LightTheme.colors.primaryDark,
  primarySoft: LightTheme.colors.primarySoft,
  primaryMid: LightTheme.colors.primaryMid,

  // Status
  statusPending: LightTheme.colors.statusPending,
  statusPartial: LightTheme.colors.statusPartial,
  statusPaid: LightTheme.colors.statusPaid,
  statusConfirmed: LightTheme.colors.statusConfirmed,
  statusOverdue: LightTheme.colors.statusOverdue,

  // Status soft backgrounds
  statusPendingSoft: LightTheme.colors.statusPendingSoft,
  statusPartialSoft: LightTheme.colors.statusPartialSoft,
  statusPaidSoft: LightTheme.colors.statusPaidSoft,
  statusConfirmedSoft: LightTheme.colors.statusConfirmedSoft,
  statusOverdueSoft: LightTheme.colors.statusOverdueSoft,

  // Neutral
  background: LightTheme.colors.background,
  surface: LightTheme.colors.surface,
  border: LightTheme.colors.border,
  divider: LightTheme.colors.divider,

  // Text
  textPrimary: LightTheme.colors.textPrimary,
  textSecondary: LightTheme.colors.textSecondary,
  textDisabled: LightTheme.colors.textDisabled,
  textOnPrimary: LightTheme.colors.textOnPrimary,
  textOnGradient: LightTheme.colors.textOnGradient,
  textOnGradientMuted: LightTheme.colors.textOnGradientMuted,

  // Gradient pairs
  gradientHero: LightTheme.gradients.hero as string[],
  gradientHeroSubtle: LightTheme.gradients.heroSubtle as string[],

  // Functional
  success: LightTheme.colors.success,
  warning: LightTheme.colors.warning,
  error: LightTheme.colors.error,
  info: LightTheme.colors.info,
} as const;

export type ColorKey = keyof typeof Colors;

export const Shadows = LightTheme.shadows;
