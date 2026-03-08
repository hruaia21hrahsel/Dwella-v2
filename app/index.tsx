import { View, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';
import { DwellaLogo } from '@/components/DwellaLogo';

export default function Index() {
  const { session, isLoading } = useAuthStore();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <DwellaLogo size={120} color={colors.textOnPrimary} />
        <Text style={{ color: colors.textOnPrimary, fontSize: 16, fontStyle: 'italic', opacity: 0.85 }}>
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
