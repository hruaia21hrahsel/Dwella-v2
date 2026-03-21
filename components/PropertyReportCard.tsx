import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AnimatedCard } from '@/components/AnimatedCard';
import { GlassCard } from '@/components/GlassCard';
import { SparklineChart } from '@/components/SparklineChart';
import { useTheme } from '@/lib/theme-context';
import { PropertySummary } from '@/lib/reports';
import { formatCurrency } from '@/lib/utils';

interface PropertyReportCardProps {
  summary: PropertySummary;
  index: number;
  onPress: (propertyId: string) => void;
}

export function PropertyReportCard({ summary, index, onPress }: PropertyReportCardProps) {
  const { colors } = useTheme();

  const netPLColor = summary.netPL >= 0 ? colors.statusConfirmed : colors.error;
  const netPLPrefix = summary.netPL >= 0 ? '+' : '-';
  const netPLFormatted = `${netPLPrefix}${formatCurrency(Math.abs(summary.netPL))}`;

  return (
    <AnimatedCard index={index}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onPress(summary.propertyId)}
      >
        <GlassCard variant="default" style={styles.card}>
          <View style={styles.row}>
            {/* Left side */}
            <View style={styles.leftSide}>
              <Text style={[styles.propertyName, { color: colors.textPrimary }]} numberOfLines={1}>
                {summary.propertyName}
              </Text>
              <Text style={[styles.netPL, { color: netPLColor }]} numberOfLines={1}>
                {netPLFormatted}
              </Text>
              <Text style={[styles.occupancy, { color: colors.textSecondary }]} numberOfLines={1}>
                {`${summary.filledUnits}/${summary.totalUnits} units`}
              </Text>
            </View>

            {/* Right side: sparkline */}
            <View style={styles.rightSide}>
              <SparklineChart
                data={summary.monthlyPL}
                width={100}
                height={40}
              />
            </View>
          </View>
        </GlassCard>
      </TouchableOpacity>
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftSide: {
    flex: 1,
    gap: 2,
  },
  propertyName: {
    fontSize: 16,
    fontWeight: '700',
  },
  netPL: {
    fontSize: 20,
    fontWeight: '700',
  },
  occupancy: {
    fontSize: 13,
    fontWeight: '400',
  },
  rightSide: {
    width: 100,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
