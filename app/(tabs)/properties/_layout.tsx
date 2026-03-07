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
        headerTitle: () => null,
        headerBackground: () => (
          <View style={{ flex: 1 }} pointerEvents="none">
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 96, alignItems: 'center', justifyContent: 'center' }}>
              <DwellaHeaderTitle />
            </View>
          </View>
        ),
        headerLeft: () => <ProfileHeaderButton />,
        headerRight: () => <View style={{ width: 56 }} />,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
