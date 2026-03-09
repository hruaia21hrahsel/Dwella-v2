import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/theme-context';

export default function ToolsLayout() {
  const { colors, gradients } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerBackground: () => (
          <LinearGradient colors={[colors.surface, gradients.heroSubtle[1]]} start={{ x: 0.35, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        ),
        headerTintColor: colors.textPrimary,
        headerTitleAlign: 'center',
      }}
    />
  );
}
