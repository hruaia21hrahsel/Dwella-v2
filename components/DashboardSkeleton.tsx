import { View, StyleSheet } from 'react-native';
import { Skeleton } from './Skeleton';
import { Colors } from '@/constants/colors';

export function DashboardSkeleton() {
  return (
    <View style={styles.container}>
      {/* Hero card */}
      <Skeleton width="100%" height={52} borderRadius={16} />

      {/* Payment grid placeholder */}
      <Skeleton width="100%" height={100} borderRadius={14} style={{ marginTop: 12 }} />

      {/* Stats grid 2x2 */}
      <View style={styles.statsGrid}>
        <Skeleton width="48%" height={70} borderRadius={16} />
        <Skeleton width="48%" height={70} borderRadius={16} />
        <Skeleton width="48%" height={70} borderRadius={16} />
        <Skeleton width="48%" height={70} borderRadius={16} />
      </View>

      {/* Recent transactions */}
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} width="100%" height={64} borderRadius={14} style={{ marginTop: 8 }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: Colors.background,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 24,
    marginBottom: 12,
  },
});
