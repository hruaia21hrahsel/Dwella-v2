import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function ToolsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.textPrimary,
        headerTitleAlign: 'center',
      }}
    />
  );
}
