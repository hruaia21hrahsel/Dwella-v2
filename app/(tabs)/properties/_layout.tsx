import { Stack } from 'expo-router';
import { DwellaHeader } from '@/components/DwellaHeader';

export default function PropertiesLayout() {
  return (
    <Stack
      screenOptions={{
        header: () => <DwellaHeader />,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
