import { View, StyleSheet } from 'react-native';
import { Skeleton } from './Skeleton';
import { useTheme } from '@/lib/theme-context';

interface ListSkeletonProps {
  count?: number;
  rowHeight?: number;
}

export function ListSkeleton({ count = 3, rowHeight = 80 }: ListSkeletonProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
  },
});
