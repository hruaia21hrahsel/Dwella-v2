import { View, StyleSheet } from 'react-native';
import { Skeleton } from '@/components/Skeleton';

interface ReportSkeletonProps {
  variant: 'portfolio' | 'property';
}

export function ReportSkeleton({ variant }: ReportSkeletonProps) {
  if (variant === 'portfolio') {
    return (
      <View style={styles.container}>
        {/* 2x2 KPI grid */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiRow}>
            <Skeleton width="48%" height={88} borderRadius={12} />
            <Skeleton width="48%" height={88} borderRadius={12} />
          </View>
          <View style={styles.kpiRow}>
            <Skeleton width="48%" height={88} borderRadius={12} />
            <Skeleton width="48%" height={88} borderRadius={12} />
          </View>
        </View>

        {/* Property summary cards */}
        <View style={styles.cardsSection}>
          <Skeleton width="100%" height={80} borderRadius={12} style={styles.cardSkeleton} />
          <Skeleton width="100%" height={80} borderRadius={12} style={styles.cardSkeleton} />
          <Skeleton width="100%" height={80} borderRadius={12} style={styles.cardSkeleton} />
        </View>
      </View>
    );
  }

  // property variant
  return (
    <View style={styles.container}>
      {/* TimeControlBar height placeholder */}
      <Skeleton width="100%" height={100} borderRadius={12} style={styles.cardSkeleton} />
      {/* Chart sections: P&L 200, Donut 220, Reliability 100, Occupancy 180 */}
      <Skeleton width="100%" height={200} borderRadius={12} style={styles.cardSkeleton} />
      <Skeleton width="100%" height={220} borderRadius={12} style={styles.cardSkeleton} />
      <Skeleton width="100%" height={100} borderRadius={12} style={styles.cardSkeleton} />
      <Skeleton width="100%" height={180} borderRadius={12} style={styles.cardSkeleton} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  kpiGrid: {
    gap: 8,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardsSection: {
    gap: 8,
    marginTop: 8,
  },
  cardSkeleton: {
    marginBottom: 0,
  },
});
