import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme-context';
import { TenantReliability } from '@/lib/reports';

interface ReliabilityTableProps {
  data: TenantReliability[];
  hasData: boolean;
  emptyLabel?: string;
}

function getScoreColor(onTimePct: number, colors: ReturnType<typeof useTheme>['colors']): string {
  if (onTimePct >= 90) return colors.statusConfirmed;
  if (onTimePct >= 70) return colors.statusPartial;
  return colors.statusOverdue;
}

export function ReliabilityTable({ data, hasData, emptyLabel }: ReliabilityTableProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.tenantCol, { color: colors.textSecondary }]}>
          Tenant
        </Text>
        <Text style={[styles.headerCell, styles.onTimeCol, { color: colors.textSecondary }]}>
          On-Time
        </Text>
        <Text style={[styles.headerCell, styles.avgLateCol, { color: colors.textSecondary }]}>
          Avg Days Late
        </Text>
      </View>

      {!hasData ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {emptyLabel ?? 'No data available'}
          </Text>
        </View>
      ) : (
        data.map((item, index) => (
          <View key={item.tenantId}>
            {index > 0 && (
              <View style={[styles.separator, { backgroundColor: colors.divider }]} />
            )}
            <View style={styles.dataRow}>
              {/* Tenant column */}
              <View style={[styles.tenantCol]}>
                <Text style={[styles.tenantName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.tenantName}
                </Text>
                <Text style={[styles.flatNo, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.flatNo}
                </Text>
              </View>

              {/* On-time % column */}
              <View style={[styles.onTimeCol, styles.centerAlign]}>
                <Text style={[styles.onTimePct, { color: getScoreColor(item.onTimePct, colors) }]}>
                  {`${item.onTimePct}%`}
                </Text>
              </View>

              {/* Avg days late column */}
              <View style={[styles.avgLateCol, styles.rightAlign]}>
                <Text style={[styles.avgLateText, { color: colors.textSecondary }]}>
                  {item.avgDaysLate === 0 ? '\u2014' : `${item.avgDaysLate} days`}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 100,
  },
  headerRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    marginBottom: 4,
  },
  headerCell: {
    fontSize: 13,
    fontWeight: '400',
  },
  tenantCol: {
    flex: 2,
  },
  onTimeCol: {
    flex: 1,
  },
  avgLateCol: {
    flex: 1,
  },
  centerAlign: {
    alignItems: 'center',
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  separator: {
    height: 1,
    marginVertical: 4,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tenantName: {
    fontSize: 16,
    fontWeight: '700',
  },
  flatNo: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  onTimePct: {
    fontSize: 16,
    fontWeight: '700',
  },
  avgLateText: {
    fontSize: 13,
    fontWeight: '400',
  },
  emptyContainer: {
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '400',
  },
});
