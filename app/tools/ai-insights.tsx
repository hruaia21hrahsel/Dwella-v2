import { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { AnimatedCard } from '@/components/AnimatedCard';
import { formatCurrency, getCurrentMonthYear, getMonthName } from '@/lib/utils';
import { useTrack, EVENTS } from '@/lib/analytics';
import { AiDisclosureModal } from '@/components/AiDisclosureModal';

interface InsightsData {
  summary: string;
  highlights: string[];
  trends: string[];
  recommendations: string[];
  metrics: {
    collection_rate: number;
    net_income: number;
    overdue_amount: number;
  };
}

const FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-insights`;

export default function AiInsightsScreen() {
  const { user } = useAuthStore();
  const { colors, shadows } = useTheme();
  const track = useTrack();
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isYearly, setIsYearly] = useState(false);
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const period = isYearly ? 'yearly' : `${selectedMonth}/${selectedYear}`;
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ user_id: user.id, period, mode: 'full' }),
      });

      if (!res.ok) throw new Error(`Error: ${res.status}`);
      const result = await res.json();
      setData(result);
      track(EVENTS.AI_INSIGHTS_VIEWED, { period: isYearly ? 'yearly' : 'monthly' });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [user, selectedMonth, selectedYear, isYearly]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return (
    <>
      <AiDisclosureModal />
      <Stack.Screen options={{ title: 'AI Insights' }} />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        {/* Period selector */}
        <View style={styles.periodRow}>
          <TouchableOpacity
            style={[styles.periodChip, { borderColor: colors.border, backgroundColor: colors.surface }, !isYearly && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
            onPress={() => setIsYearly(false)}
          >
            <Text style={[styles.periodText, { color: colors.textSecondary }, !isYearly && { color: colors.primary }]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodChip, { borderColor: colors.border, backgroundColor: colors.surface }, isYearly && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
            onPress={() => setIsYearly(true)}
          >
            <Text style={[styles.periodText, { color: colors.textSecondary }, isYearly && { color: colors.primary }]}>Yearly</Text>
          </TouchableOpacity>
        </View>

        {!isYearly && (
          <View style={styles.monthRow}>
            <TouchableOpacity
              onPress={() => {
                if (selectedMonth <= 1) {
                  setSelectedMonth(12);
                  setSelectedYear((y) => y - 1);
                } else {
                  setSelectedMonth((m) => m - 1);
                }
              }}
            >
              <MaterialCommunityIcons name="chevron-left" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.monthText, { color: colors.textPrimary }]}>{getMonthName(selectedMonth)} {selectedYear}</Text>
            <TouchableOpacity
              onPress={() => {
                if (selectedMonth >= 12) {
                  setSelectedMonth(1);
                  setSelectedYear((y) => y + 1);
                } else {
                  setSelectedMonth((m) => m + 1);
                }
              }}
            >
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Analyzing your data...</Text>
          </View>
        )}

        {error && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.error }]}>
            <Text style={{ color: colors.error }}>{error}</Text>
            <TouchableOpacity onPress={fetchInsights} style={styles.retryBtn}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {data && !loading && (
          <>
            {/* Summary */}
            <AnimatedCard index={0}>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.sm]}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="text-box-outline" size={18} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Summary</Text>
                </View>
                <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{data.summary}</Text>
              </View>
            </AnimatedCard>

            {/* Metrics */}
            {data.metrics && (
              <AnimatedCard index={1}>
                <View style={styles.metricsRow}>
                  <View style={[styles.metricCard, { backgroundColor: colors.surface }, shadows.sm]}>
                    <Text style={[styles.metricValue, { color: colors.statusConfirmed }]}>
                      {data.metrics.collection_rate}%
                    </Text>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Collection Rate</Text>
                  </View>
                  <View style={[styles.metricCard, { backgroundColor: colors.surface }, shadows.sm]}>
                    <Text style={[styles.metricValue, { color: colors.primary }]}>
                      {formatCurrency(data.metrics.net_income)}
                    </Text>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Net Income</Text>
                  </View>
                  <View style={[styles.metricCard, { backgroundColor: colors.surface }, shadows.sm]}>
                    <Text style={[styles.metricValue, { color: colors.statusOverdue }]}>
                      {formatCurrency(data.metrics.overdue_amount)}
                    </Text>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Overdue</Text>
                  </View>
                </View>
              </AnimatedCard>
            )}

            {/* Highlights */}
            {data.highlights?.length > 0 && (
              <AnimatedCard index={2}>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.sm]}>
                  <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="star-outline" size={18} color={colors.statusPartial} />
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Highlights</Text>
                  </View>
                  {data.highlights.map((h, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <Text style={[styles.bullet, { color: colors.textSecondary }]}>•</Text>
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{h}</Text>
                    </View>
                  ))}
                </View>
              </AnimatedCard>
            )}

            {/* Trends */}
            {data.trends?.length > 0 && (
              <AnimatedCard index={3}>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.sm]}>
                  <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="trending-up" size={18} color={colors.info} />
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Trends</Text>
                  </View>
                  {data.trends.map((t, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <Text style={[styles.bullet, { color: colors.textSecondary }]}>•</Text>
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{t}</Text>
                    </View>
                  ))}
                </View>
              </AnimatedCard>
            )}

            {/* Recommendations */}
            {data.recommendations?.length > 0 && (
              <AnimatedCard index={4}>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.sm]}>
                  <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="lightbulb-outline" size={18} color={colors.statusConfirmed} />
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Recommendations</Text>
                  </View>
                  {data.recommendations.map((r, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <Text style={[styles.bullet, { color: colors.textSecondary }]}>•</Text>
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{r}</Text>
                    </View>
                  ))}
                </View>
              </AnimatedCard>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  centered: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 14 },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  periodChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  periodText: {
    fontSize: 14,
    fontWeight: '600',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 4,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 140,
    textAlign: 'center',
  },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  bulletRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    gap: 8,
  },
  bullet: {
    fontSize: 14,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 8,
    alignSelf: 'center',
  },
});
