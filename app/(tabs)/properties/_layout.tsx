import { View } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';
import { ProfileHeaderButton } from '@/components/ProfileHeaderButton';
import { DwellaHeaderTitle } from '@/components/DwellaHeaderTitle';

export default function PropertiesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
        headerTitleAlign: 'center',
        headerTitle: () => <DwellaHeaderTitle />,
        headerLeft: () => <ProfileHeaderButton />,
        headerRight: () => <View style={{ width: 50 }} />,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
