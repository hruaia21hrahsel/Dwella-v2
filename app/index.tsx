import { View, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/lib/store';
import { Colors } from '@/constants/colors';
import { DwellaLogo } from '@/components/DwellaLogo';

export default function Index() {
  const { session, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <DwellaLogo size={120} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 16, fontStyle: 'italic', opacity: 0.85 }}>
          The AI that runs your rentals.
        </Text>
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/(auth)/login" />;
}
