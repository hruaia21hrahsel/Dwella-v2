import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme-context';

interface ChartTooltipProps {
  visible: boolean;
  label: string;
  value: string;
  x: number;
  y: number;
}

export function ChartTooltip({ visible, label, value, x, y }: ChartTooltipProps) {
  const { colors, shadows } = useTheme();

  if (!visible) return null;

  // Tooltip width estimate — flip left if in right half of a typical 300px chart
  const isRightHalf = x > 150;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          top: y,
          left: isRightHalf ? undefined : x,
          right: isRightHalf ? undefined : undefined,
          transform: isRightHalf
            ? [{ translateX: x - 120 }]
            : [{ translateX: x }],
        },
      ]}
    >
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 80,
    zIndex: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
  },
});
