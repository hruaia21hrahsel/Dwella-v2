import { Stack } from 'expo-router';
import { useTheme } from '@/lib/theme-context';

export default function ToolsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background } as any,
        headerTintColor: colors.textPrimary,
        headerTitleAlign: 'center',
        headerShadowVisible: false,
      }}
    />
  );
}
