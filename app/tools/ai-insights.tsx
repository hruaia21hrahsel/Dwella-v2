import { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Colors, Shadows } from '@/constants/colors';
import { AnimatedCard } from '@/components/AnimatedCard';
import { formatCurrency, getCurrentMonthYear, getMonthName } from '@/lib/utils';

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
      <Stack.Screen options={{ title: 'AI Insights' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Period selector */}
        <View style={styles.periodRow}>
          <TouchableOpacity
            style={[styles.periodChip, !isYearly && styles.periodChipActive]}
            onPress={() => setIsYearly(false)}
          >
            <Text style={[styles.periodText, !isYearly && styles.periodTextActive]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodChip, isYearly && styles.periodChipActive]}
            onPress={() => setIsYearly(true)}
          >
            <Text style={[styles.periodText, isYearly && styles.periodTextActive]}>Yearly</Text>
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
              <MaterialCommunityIcons name="chevron-left" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.monthText}>{getMonthName(selectedMonth)} {selectedYear}</Text>
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
              <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Analyzing your data...</Text>
          </View>
        )}

        {error && (
          <View style={[styles.card, { borderColor: Colors.error }]}>
            <Text style={{ color: Colors.error }}>{error}</Text>
            <TouchableOpacity onPress={fetchInsights} style={styles.retryBtn}>
              <Text style={{ color: Colors.primary, fontWeight: '600' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {data && !loading && (
          <>
            {/* Summary */}
            <AnimatedCard index={0}>
              <View style={[styles.card, Shadows.sm]}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="text-box-outline" size={18} color={Colors.primary} />
                  <Text style={styles.cardTitle}>Summary</Text>
                </View>
                <Text style={styles.cardBody}>{data.summary}</Text>
              </View>
            </AnimatedCard>

            {/* Metrics */}
            {data.metrics && (
              <AnimatedCard index={1}>
                <View style={styles.metricsRow}>
                  <View style={[styles.metricCard, Shadows.sm]}>
                    <Text style={[styles.metricValue, { color: Colors.statusConfirmed }]}>
                      {data.metrics.collection_rate}%
                    </Text>
                    <Text style={styles.metricLabel}>Collection Rate</Text>
                  </View>
                  <View style={[styles.metricCard, Shadows.sm]}>
                    <Text style={[styles.metricValue, { color: Colors.primary }]}>
                      {formatCurrency(data.metrics.net_income)}
                    </Text>
                    <Text style={styles.metricLabel}>Net Income</Text>
                  </View>
                  <View style={[styles.metricCard, Shadows.sm]}>
                    <Text style={[styles.metricValue, { color: Colors.statusOverdue }]}>
                      {formatCurrency(data.metrics.overdue_amount)}
                    </Text>
                    <Text style={styles.metricLabel}>Overdue</Text>
                  </View>
                </View>
              </AnimatedCard>
            )}

            {/* Highlights */}
            {data.highlights?.length > 0 && (
              <AnimatedCard index={2}>
                <View style={[styles.card, Shadows.sm]}>
                  <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="star-outline" size={18} color={Colors.statusPartial} />
                    <Text style={styles.cardTitle}>Highlights</Text>
                  </View>
                  {data.highlights.map((h, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.bulletText}>{h}</Text>
                    </View>
                  ))}
                </View>
              </AnimatedCard>
            )}

            {/* Trends */}
            {data.trends?.length > 0 && (
              <AnimatedCard index={3}>
                <View style={[styles.card, Shadows.sm]}>
                  <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="trending-up" size={18} color={Colors.info} />
                    <Text style={styles.cardTitle}>Trends</Text>
                  </View>
                  {data.trends.map((t, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.bulletText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </AnimatedCard>
            )}

            {/* Recommendations */}
            {data.recommendations?.length > 0 && (
              <AnimatedCard index={4}>
                <View style={[styles.card, Shadows.sm]}>
                  <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="lightbulb-outline" size={18} color={Colors.statusConfirmed} />
                    <Text style={styles.cardTitle}>Recommendations</Text>
                  </View>
                  {data.recommendations.map((r, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.bulletText}>{r}</Text>
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
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  centered: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { color: Colors.textSecondary, marginTop: 12, fontSize: 14 },
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
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  periodChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  periodText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  periodTextActive: {
    color: Colors.primary,
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
    color: Colors.textPrimary,
    minWidth: 140,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.textPrimary,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.surface,
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
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  bulletRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    gap: 8,
  },
  bullet: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  retryBtn: {
    marginTop: 8,
    alignSelf: 'center',
  },
});
