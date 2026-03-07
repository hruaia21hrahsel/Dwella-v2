import { View } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';
import { ProfileHeaderButton } from '@/components/ProfileHeaderButton';
import { DwellaHeaderTitle } from '@/components/DwellaHeaderTitle';

export default function PropertiesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface, height: 96 },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
        headerTitleAlign: 'center',
        headerTitleContainerStyle: { left: 0, right: 0 },
        headerTitle: () => <DwellaHeaderTitle />,
        headerLeft: () => <ProfileHeaderButton />,
        headerRight: () => <View style={{ width: 56 }} />,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
