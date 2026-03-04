import { View, StyleSheet } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { Colors } from '@/constants/colors';

export default function InviteScreen() {
  return (
    <View style={styles.container}>
      <EmptyState
        icon="account-check"
        title="Invite Acceptance — Coming Soon"
        subtitle="Tenant invite acceptance via deep link will be implemented in Phase B."
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
