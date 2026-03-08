import { Stack } from 'expo-router';
import { useTheme } from '@/lib/theme-context';

export default function ToolsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerTitleAlign: 'center',
      }}
    />
  );
}
