import { View, StyleSheet } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { Colors } from '@/constants/colors';

export default function PaymentsScreen() {
  return (
    <View style={styles.container}>
      <EmptyState
        icon="receipt"
        title="Payments — Coming Soon"
        subtitle="Payment tracking and proof uploads will be available in Phase B."
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
