import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useTheme } from '@/lib/theme-context';
import { useTrack } from '@/lib/analytics';
import { formatCurrency } from '@/lib/utils';
import { usePortfolioData } from '@/hooks/useReportData';
import { KpiCard } from '@/components/KpiCard';
import { PropertyReportCard } from '@/components/PropertyReportCard';
import { ReportSkeleton } from '@/components/ReportSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { TimeControlBar } from '@/components/TimeControlBar';

export default function PortfolioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const track = useTrack();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { kpis, summaries, isLoading, error, refresh } = usePortfolioData(year);

  useEffect(() => {
    track('report_portfolio_viewed');
  }, []);

  // Card width: (screenWidth - 48) / 2  (16px padding each side + 8px gap)
  const kpiCardWidth = (screenWidth - 48) / 2;

  const netPLPrefix = kpis.netPL >= 0 ? '+' : '';
  const netPLColor = kpis.netPL >= 0 ? colors.statusConfirmed : colors.error;

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
      {/* Screen title */}
      <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Analytics</Text>

      {/* Year selector using TimeControlBar in yearly-only mode */}
      <View style={styles.yearSelector}>
        <TimeControlBar
          period={{ year, granularity: 'yearly' }}
          onPeriodChange={(p) => setYear(p.year)}
        />
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
        <ReportSkeleton variant="portfolio" />
      ) : (
        <>
          {/* KPI Grid — 2x2 */}
          <View style={styles.kpiGrid}>
            <View style={styles.kpiRow}>
              <View style={{ width: kpiCardWidth }}>
                <KpiCard
                  label="Total Income"
                  value={formatCurrency(kpis.totalIncome)}
                  valueColor={colors.statusConfirmed}
                  icon="cash-plus"
                />
              </View>
              <View style={{ width: kpiCardWidth }}>
                <KpiCard
                  label="Total Expenses"
                  value={formatCurrency(kpis.totalExpenses)}
                  valueColor={colors.error}
                  icon="cash-minus"
                />
              </View>
            </View>
            <View style={styles.kpiRow}>
              <View style={{ width: kpiCardWidth }}>
                <KpiCard
                  label="Net P&L"
                  value={`${netPLPrefix}${formatCurrency(Math.abs(kpis.netPL))}`}
                  valueColor={netPLColor}
                  icon="chart-line"
                />
              </View>
              <View style={{ width: kpiCardWidth }}>
                <KpiCard
                  label="Occupancy"
                  value={`${kpis.filledUnits}/${kpis.totalUnits} units`}
                  icon="home-group"
                />
              </View>
            </View>
          </View>

          {/* Property list */}
          <View style={styles.propertiesSection}>
            {summaries.length === 0 ? (
              <EmptyState
                icon="home-outline"
                title="No Properties Yet"
                subtitle="Add a property to start seeing your analytics."
              />
            ) : (
              summaries.map((summary, index) => (
                <PropertyReportCard
                  key={summary.propertyId}
                  summary={summary}
                  index={index}
                  onPress={(id) => router.push(`/reports/${id}` as Href)}
                />
              ))
            )}
          </View>
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
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  yearSelector: {
    marginBottom: 20,
  },
  kpiGrid: {
    gap: 8,
    marginBottom: 24,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  propertiesSection: {
    gap: 12,
  },
});
