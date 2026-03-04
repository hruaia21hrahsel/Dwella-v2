import { View, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { Colors } from '@/constants/colors';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
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
    backgroundColor: Colors.background,
    justifyContent: 'center',
  },
});
