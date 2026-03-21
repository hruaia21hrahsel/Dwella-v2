import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme-context';
import { useTrack } from '@/lib/analytics';
import { getMonthName } from '@/lib/utils';
import { TimePeriod, Granularity } from '@/lib/reports';
import { usePropertyReportData } from '@/hooks/useReportData';
import { TimeControlBar } from '@/components/TimeControlBar';
import { PLBarChart } from '@/components/PLBarChart';
import { DonutChart } from '@/components/DonutChart';
import { OccupancyChart } from '@/components/OccupancyChart';
import { ChartSectionCard } from '@/components/ChartSectionCard';
import { ReliabilityTable } from '@/components/ReliabilityTable';
import { ReportSkeleton } from '@/components/ReportSkeleton';
import { ErrorBanner } from '@/components/ErrorBanner';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEmptyLabel(period: TimePeriod): string {
  if (period.granularity === 'yearly') return `No data for ${period.year}`;
  if (period.granularity === 'quarterly') return `No data for Q${period.quarter} ${period.year}`;
  return `No data for ${getMonthName(period.month ?? 1)} ${period.year}`;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function PropertyReportScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const track = useTrack();

  const [period, setPeriod] = useState<TimePeriod>({
    year: new Date().getFullYear(),
    granularity: 'yearly' as Granularity,
  });

  const {
    propertyName,
    plData,
    categoryData,
    reliabilityData,
    occupancyData,
    totalExpenses,
    plHasData,
    categoryHasData,
    reliabilityHasData,
    occupancyHasData,
    isLoading,
    error,
    refresh,
  } = usePropertyReportData(propertyId ?? '', period);

  useEffect(() => {
    if (propertyId) {
      track('report_property_viewed', { propertyId });
    }
  }, [propertyId]);

  function handlePeriodChange(newPeriod: TimePeriod) {
    track('report_granularity_changed', { granularity: newPeriod.granularity });
    setPeriod(newPeriod);
  }

  const emptyLabel = getEmptyLabel(period);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 48 }]}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Time period selector */}
      <View style={styles.timeControlWrapper}>
        <TimeControlBar period={period} onPeriodChange={handlePeriodChange} />
      </View>

      {/* Error state */}
      {error ? (
        <ErrorBanner
          error="Couldn't load report data. Pull down to try again."
          onRetry={refresh}
        />
      ) : null}

      {/* Loading state */}
      {isLoading ? (
        <ReportSkeleton variant="property" />
      ) : (
        <>
          {/* P&L Section — RPT-01 */}
          <ChartSectionCard title="Profit & Loss" icon="chart-bar" style={styles.section}>
            <PLBarChart data={plData} hasData={plHasData} emptyLabel={emptyLabel} />
          </ChartSectionCard>

          {/* Expense Breakdown — RPT-02 */}
          <ChartSectionCard title="Expense Breakdown" icon="chart-donut" style={styles.section}>
            <DonutChart
              data={categoryData}
              totalAmount={totalExpenses}
              hasData={categoryHasData}
              emptyLabel={emptyLabel}
            />
          </ChartSectionCard>

          {/* Payment Reliability — RPT-03 */}
          <ChartSectionCard title="Payment Reliability" icon="account-check" style={styles.section}>
            <ReliabilityTable
              data={reliabilityData}
              hasData={reliabilityHasData}
              emptyLabel={emptyLabel}
            />
          </ChartSectionCard>

          {/* Occupancy — RPT-04 */}
          <ChartSectionCard title="Occupancy" icon="home-group" style={styles.section}>
            <OccupancyChart
              data={occupancyData}
              hasData={occupancyHasData}
              emptyLabel={emptyLabel}
            />
          </ChartSectionCard>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 24,
  },
  timeControlWrapper: {
    // TimeControlBar already has internal layout
  },
  section: {
    // spacing handled by parent gap
  },
});
