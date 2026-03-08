import { View, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/lib/theme-context';

export default function NotFoundScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <EmptyState
        icon="alert-circle"
        title="Page Not Found"
        subtitle="The screen you're looking for doesn't exist."
        actionLabel="Go Home"
        onAction={() => router.replace('/(tabs)/properties')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
});
