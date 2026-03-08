import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useAuthStore } from './store';
import { LightTheme, DarkTheme, Theme, ThemeColors, ThemeGradients, ThemeShadows } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  colors: ThemeColors;
  gradients: ThemeGradients;
  shadows: ThemeShadows;
  typography: typeof Typography;
  spacing: typeof Spacing;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: LightTheme.colors,
  gradients: LightTheme.gradients,
  shadows: LightTheme.shadows,
  typography: Typography,
  spacing: Spacing,
  isDark: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeMode = useAuthStore((s) => s.themeMode);
  const systemScheme = useColorScheme();

  const value = useMemo(() => {
    let isDark = false;
    if (themeMode === 'dark') isDark = true;
    else if (themeMode === 'system') isDark = systemScheme === 'dark';

    const theme: Theme = isDark ? DarkTheme : LightTheme;

    return {
      colors: theme.colors,
      gradients: theme.gradients,
      shadows: theme.shadows,
      typography: Typography,
      spacing: Spacing,
      isDark,
    };
  }, [themeMode, systemScheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function useThemeToggle() {
  const mode = useAuthStore((s) => s.themeMode);
  const setMode = useAuthStore((s) => s.setThemeMode);
  return { mode, setMode };
}
