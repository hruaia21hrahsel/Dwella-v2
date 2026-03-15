import { useState, useCallback } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { AnimatedCard } from '@/components/AnimatedCard';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { formatCurrency, getMonthName } from '@/lib/utils';
import { useTrack, EVENTS } from '@/lib/analytics';
import type { PaymentStatus } from '@/lib/types';

interface SearchResult {
  type: 'payment' | 'tenant' | 'property';
  id: string;
  [key: string]: unknown;
}

interface SearchResponse {
  explanation: string;
  results: SearchResult[];
  count: number;
}

const FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-search`;

export default function AiSearchScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { colors, shadows } = useTheme();
  const track = useTrack();
  const [query, setQuery] = useState('');
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    const text = query.trim();
    if (!text || !user) return;

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ user_id: user.id, query: text }),
      });

      if (!res.ok) throw new Error(`Error: ${res.status}`);
      const result = await res.json();
      setData(result);
      track(EVENTS.AI_SEARCH_PERFORMED, { query_length: text.length });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [query, user]);

  function renderPaymentResult(item: SearchResult, index: number) {
    return (
      <AnimatedCard key={item.id} index={index}>
        <TouchableOpacity
          style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.sm]}
          activeOpacity={0.8}
          onPress={() => {
            // Navigate to payment detail if we have the needed IDs
            const tenantId = (item as any).tenant_id;
            const propertyId = (item as any).property_id;
            if (tenantId && propertyId) {
              router.push(`/property/${propertyId}/tenant/${tenantId}/payment/${item.id}`);
            }
          }}
        >
          <View style={styles.resultHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.resultTitle, { color: colors.textPrimary }]}>{(item as any).tenant_name}</Text>
              <Text style={[styles.resultSub, { color: colors.textSecondary }]}>
                Flat {(item as any).flat_no} · {(item as any).property_name}
              </Text>
            </View>
            <PaymentStatusBadge status={(item as any).status as PaymentStatus} />
          </View>
          <View style={styles.resultMeta}>
            <Text style={[styles.resultMetaText, { color: colors.textSecondary }]}>
              {getMonthName((item as any).month)} {(item as any).year}
            </Text>
            <Text style={[styles.resultAmount, { color: colors.textPrimary }]}>
              {formatCurrency((item as any).amount_paid)} / {formatCurrency((item as any).amount_due)}
            </Text>
          </View>
        </TouchableOpacity>
      </AnimatedCard>
    );
  }

  function renderTenantResult(item: SearchResult, index: number) {
    return (
      <AnimatedCard key={item.id} index={index}>
        <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.sm]}>
          <View style={styles.resultHeader}>
            <MaterialCommunityIcons name="account" size={20} color={colors.primary} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.resultTitle, { color: colors.textPrimary }]}>{(item as any).tenant_name}</Text>
              <Text style={[styles.resultSub, { color: colors.textSecondary }]}>
                Flat {(item as any).flat_no} · {(item as any).property_name}
              </Text>
            </View>
          </View>
          <View style={styles.resultMeta}>
            <Text style={[styles.resultMetaText, { color: colors.textSecondary }]}>
              Rent: {formatCurrency((item as any).monthly_rent)} · Due day: {(item as any).due_day}
            </Text>
          </View>
        </View>
      </AnimatedCard>
    );
  }

  function renderPropertyResult(item: SearchResult, index: number) {
    return (
      <AnimatedCard key={item.id} index={index}>
        <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.sm]}>
          <View style={styles.resultHeader}>
            <MaterialCommunityIcons name="home-city" size={20} color={colors.primary} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.resultTitle, { color: colors.textPrimary }]}>{(item as any).name}</Text>
              <Text style={[styles.resultSub, { color: colors.textSecondary }]}>{(item as any).address}, {(item as any).city}</Text>
            </View>
          </View>
          <Text style={[styles.resultMetaText, { color: colors.textSecondary }]}>
            {(item as any).total_units} unit(s)
          </Text>
        </View>
      </AnimatedCard>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'AI Search' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Search bar */}
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={'Try "overdue payments this month" or "Rahul\'s rent history"'}
            mode="outlined"
            style={[styles.searchInput, { backgroundColor: colors.surface }]}
            outlineStyle={styles.searchOutline}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            maxLength={200}
          />
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: colors.primary }, (!query.trim() || loading) && styles.searchBtnDisabled]}
            onPress={handleSearch}
            disabled={!query.trim() || loading}
          >
            <MaterialCommunityIcons name="magnify" size={22} color={colors.textOnPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.resultsWrap} contentContainerStyle={styles.resultsContent}>
          {loading && (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Searching...</Text>
            </View>
          )}

          {error && (
            <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.error }]}>
              <Text style={{ color: colors.error }}>{error}</Text>
            </View>
          )}

          {data && !loading && (
            <>
              <Text style={[styles.explanationText, { color: colors.textSecondary }]}>{data.explanation}</Text>
              <Text style={[styles.countText, { color: colors.textDisabled }]}>
                {data.count} result{data.count !== 1 ? 's' : ''} found
              </Text>

              {data.results.map((item, index) => {
                if (item.type === 'payment') return renderPaymentResult(item, index);
                if (item.type === 'tenant') return renderTenantResult(item, index);
                return renderPropertyResult(item, index);
              })}

              {data.count === 0 && (
                <View style={styles.emptyCard}>
                  <MaterialCommunityIcons name="magnify-close" size={36} color={colors.textDisabled} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No results found. Try a different query.</Text>
                </View>
              )}
            </>
          )}

          {!data && !loading && !error && (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="text-search" size={40} color={colors.textDisabled} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Search your data with AI</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {'Ask in plain English \u2014 "show overdue payments", "find tenants in Whitefield", "Rahul\'s payment history"'}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  searchOutline: {
    borderRadius: 14,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnDisabled: {
    opacity: 0.5,
  },
  resultsWrap: { flex: 1 },
  resultsContent: { padding: 16, paddingTop: 4, gap: 10, paddingBottom: 40 },
  centered: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 14 },
  explanationText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  countText: {
    fontSize: 12,
    marginBottom: 4,
  },
  resultCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  resultSub: {
    fontSize: 12,
    marginTop: 2,
  },
  resultMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultMetaText: {
    fontSize: 12,
  },
  resultAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
});
