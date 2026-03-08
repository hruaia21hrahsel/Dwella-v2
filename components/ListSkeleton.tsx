import { View, StyleSheet } from 'react-native';
import { Skeleton } from './Skeleton';
import { Colors } from '@/constants/colors';

interface ListSkeletonProps {
  count?: number;
  rowHeight?: number;
}

export function ListSkeleton({ count = 3, rowHeight = 80 }: ListSkeletonProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} width="100%" height={rowHeight} borderRadius={14} style={{ marginBottom: 10 }} />
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
});
