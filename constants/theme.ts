export interface ThemeColors {
  // Brand
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primarySoft: string;
  primaryMid: string;

  // Status
  statusPending: string;
  statusPartial: string;
  statusPaid: string;
  statusConfirmed: string;
  statusOverdue: string;

  // Status soft backgrounds
  statusPendingSoft: string;
  statusPartialSoft: string;
  statusPaidSoft: string;
  statusConfirmedSoft: string;
  statusOverdueSoft: string;

  // Surfaces
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  divider: string;

  // Glass
  glassBg: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  textOnPrimary: string;
  textOnGradient: string;
  textOnGradientMuted: string;

  // Functional
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface ThemeGradients {
  hero: [string, string];
  heroSubtle: [string, string];
  button: [string, string];
  glass: [string, string];
  glassOverlay: [string, string];
}

export interface ThemeShadows {
  sm: {
    shadowColor: string;
    shadowOpacity: number;
    shadowOffset: { width: number; height: number };
    shadowRadius: number;
    elevation: number;
  };
  md: {
    shadowColor: string;
    shadowOpacity: number;
    shadowOffset: { width: number; height: number };
    shadowRadius: number;
    elevation: number;
  };
  hero: {
    shadowColor: string;
    shadowOpacity: number;
    shadowOffset: { width: number; height: number };
    shadowRadius: number;
    elevation: number;
  };
}

export interface Theme {
  colors: ThemeColors;
  gradients: ThemeGradients;
  shadows: ThemeShadows;
  isDark: boolean;
}

// ── Light Theme ────────────────────────────────────────────────────────
export const LightTheme: Theme = {
  isDark: false,
  colors: {
    primary: '#009688',
    primaryLight: '#B2DFDB',
    primaryDark: '#00796B',
    primarySoft: '#E0F2F1',
    primaryMid: '#4DB6AC',

    statusPending: '#94A3B8',
    statusPartial: '#F59E0B',
    statusPaid: '#3B82F6',
    statusConfirmed: '#22C55E',
    statusOverdue: '#EF4444',

    statusPendingSoft: '#F1F5F9',
    statusPartialSoft: '#FEF3C7',
    statusPaidSoft: '#DBEAFE',
    statusConfirmedSoft: '#DCFCE7',
    statusOverdueSoft: '#FEE2E2',

    background: '#F5F5F7',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    border: 'rgba(0,0,0,0.06)',
    divider: '#F1F5F9',

    glassBg: 'rgba(255,255,255,0.85)',

    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    textDisabled: '#CBD5E1',
    textOnPrimary: '#FFFFFF',
    textOnGradient: '#FFFFFF',
    textOnGradientMuted: 'rgba(255,255,255,0.75)',

    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  gradients: {
    hero: ['#00897B', '#004D40'],
    heroSubtle: ['#E0F2F1', '#B2DFDB'],
    button: ['#00897B', '#00695C'],
    glass: ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)'],
    glassOverlay: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)'],
  },
  shadows: {
    sm: {
      shadowColor: '#00796B',
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 8,
      elevation: 3,
    },
    md: {
      shadowColor: '#00796B',
      shadowOpacity: 0.12,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 16,
      elevation: 6,
    },
    hero: {
      shadowColor: '#004D40',
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 24,
      elevation: 12,
    },
  },
};

// ── Dark Theme ─────────────────────────────────────────────────────────
export const DarkTheme: Theme = {
  isDark: true,
  colors: {
    primary: '#4DB6AC',
    primaryLight: '#80CBC4',
    primaryDark: '#00897B',
    primarySoft: 'rgba(77,182,172,0.12)',
    primaryMid: '#4DB6AC',

    statusPending: '#94A3B8',
    statusPartial: '#FBBF24',
    statusPaid: '#60A5FA',
    statusConfirmed: '#34D399',
    statusOverdue: '#F87171',

    statusPendingSoft: 'rgba(148,163,184,0.12)',
    statusPartialSoft: 'rgba(251,191,36,0.12)',
    statusPaidSoft: 'rgba(96,165,250,0.12)',
    statusConfirmedSoft: 'rgba(52,211,153,0.12)',
    statusOverdueSoft: 'rgba(248,113,113,0.12)',

    background: '#0A0A0A',
    surface: '#161616',
    surfaceElevated: '#1E1E1E',
    border: 'rgba(255,255,255,0.08)',
    divider: 'rgba(255,255,255,0.05)',

    glassBg: 'rgba(22,22,22,0.85)',

    textPrimary: '#F5F5F5',
    textSecondary: '#9E9E9E',
    textDisabled: '#555555',
    textOnPrimary: '#0A0A0A',
    textOnGradient: '#FFFFFF',
    textOnGradientMuted: 'rgba(255,255,255,0.7)',

    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',
  },
  gradients: {
    hero: ['#00695C', '#004D40'],
    heroSubtle: ['rgba(77,182,172,0.15)', 'rgba(0,105,92,0.1)'],
    button: ['#00897B', '#00695C'],
    glass: ['rgba(30,30,30,0.95)', 'rgba(22,22,22,0.85)'],
    glassOverlay: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0)'],
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 8,
      elevation: 3,
    },
    md: {
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 16,
      elevation: 6,
    },
    hero: {
      shadowColor: '#000',
      shadowOpacity: 0.5,
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 24,
      elevation: 12,
    },
  },
};
