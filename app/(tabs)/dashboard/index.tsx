import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Linking,
  AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDashboard, TenantRow } from '@/hooks/useDashboard';
import { useAiNudge } from '@/hooks/useAiNudge';
import { DwellaLogo } from '@/components/DwellaLogo';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { ErrorBanner } from '@/components/ErrorBanner';
import { AnimatedCard } from '@/components/AnimatedCard';
import { AiInsightCard } from '@/components/AiInsightCard';
import { GlassCard } from '@/components/GlassCard';
import { GradientButton } from '@/components/GradientButton';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, formatDate, getMonthName, getCurrentMonthYear } from '@/lib/utils';
import { getStatusColor } from '@/lib/payments';
import { PaymentStatus } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useToastStore } from '@/lib/toast';
import { generateTelegramLinkToken } from '@/lib/bot';
import { TELEGRAM_BOT_USERNAME } from '@/constants/config';

const SCREEN_W = Dimensions.get('window').width;
const CHIP_SIZE = Math.floor((SCREEN_W - 32 - 24 - 2 - 24 - 40) / 6);
// Overview card: outer padding 16*2 + card padding 14*2 = 60, 5 gaps of 8 = 40
const OVERVIEW_CHIP_W = Math.floor((SCREEN_W - 60 - 40) / 6);
const OVERVIEW_CHIP_H = OVERVIEW_CHIP_W + 10;

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_ICON: Record<PaymentStatus, string> = {
  pending: 'clock-outline',
  partial: 'clock-alert-outline',
  paid: 'check-circle-outline',
  confirmed: 'check-decagram',
  overdue: 'alert-circle-outline',
};

const STAT_ICONS: Record<string, string> = {
  'Total Receivable': 'bank-outline',
  'Received': 'check-circle-outline',
  'Yet to Receive': 'clock-outline',
  'Overdue': 'alert-circle-outline',
};

interface StatCardProps { label: string; value: number; color: string; surfaceBg: string; secondaryText: string }

function StatCard({ label, value, color, surfaceBg, secondaryText }: StatCardProps) {
  return (
    <View style={[styles.statCard, { backgroundColor: surfaceBg }]}>
      <View style={[styles.statAccent, { backgroundColor: color }]} />
      <MaterialCommunityIcons
        name={STAT_ICONS[label] as any}
        size={18}
        color={color}
        style={styles.statIcon}
      />
      <Text style={[styles.statValue, { color }]}>{formatCurrency(value)}</Text>
      <Text style={[styles.statLabel, { color: secondaryText }]}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, gradients, shadows, isDark } = useTheme();
  const { user, setUser } = useAuthStore();
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [summaryMonth, setSummaryMonth] = useState(currentMonth);
  const { tenantRows, stats, recentTransactions, isLoading, error, refresh } = useDashboard(selectedYear, summaryMonth);
  const { nudge: aiNudge, loading: aiNudgeLoading } = useAiNudge(user?.id);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [linkingTelegram, setLinkingTelegram] = useState(false);

  const telegramLinked = !!user?.telegram_chat_id;

  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active' && user && !user.telegram_chat_id) {
        const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
        if (data?.telegram_chat_id) {
          setUser(data);
          useToastStore.getState().showToast('Telegram linked successfully!', 'success');
        }
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [user, setUser]);

  const handleLinkTelegram = useCallback(async () => {
    if (!user) return;
    setLinkingTelegram(true);
    try {
      const token = await generateTelegramLinkToken(user.id);
      const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
      if (data) setUser(data);
      const deepLink = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`;
      const canOpen = await Linking.canOpenURL(deepLink);
      if (canOpen) {
        await Linking.openURL(deepLink);
      } else {
        useToastStore.getState().showToast('Please install Telegram, then try again.', 'error');
      }
    } catch (err) {
      useToastStore.getState().showToast(String(err), 'error');
    } finally {
      setLinkingTelegram(false);
    }
  }, [user, setUser]);


  useEffect(() => {
    async function fetchMonthlyExpenses() {
      const startDate = `${selectedYear}-${String(summaryMonth).padStart(2, '0')}-01`;
      const nextMonth = summaryMonth === 12 ? 1 : summaryMonth + 1;
      const nextYear = summaryMonth === 12 ? selectedYear + 1 : selectedYear;
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      const { data } = await supabase
        .from('expenses')
        .select('amount')
        .gte('expense_date', startDate)
        .lt('expense_date', endDate);
      const total = (data ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0);
      setMonthlyExpenses(total);
    }
    fetchMonthlyExpenses();
  }, [summaryMonth, selectedYear]);

  const properties = [
    ...new Map(
      tenantRows.map((r) => [r.propertyId, { id: r.propertyId, name: r.propertyName }])
    ).values(),
  ];

  const tenantsForProperty = tenantRows.filter((r) => r.propertyId === selectedPropertyId);

  useEffect(() => {
    if (tenantRows.length === 0) return;
    if (!selectedPropertyId) {
      const firstProp = tenantRows[0].propertyId;
      setSelectedPropertyId(firstProp);
      setSelectedTenantId(tenantRows.find((r) => r.propertyId === firstProp)?.tenantId ?? null);
    }
  }, [tenantRows]);

  function selectProperty(propId: string) {
    setSelectedPropertyId(propId);
    const firstTenant = tenantRows.find((r) => r.propertyId === propId);
    setSelectedTenantId(firstTenant?.tenantId ?? null);
  }

  const selectedRow: TenantRow | undefined = tenantRows.find(
    (r) => r.tenantId === selectedTenantId
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [refresh]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Scrollable header */}
      <View style={[styles.inlineHeader, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/profile')}
          style={{ width: 56, alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="account-circle-outline" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <DwellaLogo width={180} height={44} color={colors.textPrimary} />
        </View>
        <TouchableOpacity
          onPress={() => router.push('/notifications')}
          style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="bell-outline" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ErrorBanner error={error} onRetry={refresh} />

      {/* Overview section */}
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.overviewCard, shadows.hero]}
      >
        {/* Abstract background decoration — Design 6: bold arc + accent */}
        <View style={styles.overviewDecorArc} />
        <View style={styles.overviewDecorArcInner} />
        <View style={styles.overviewDecorAccent} />

        {/* Title row */}
        <View style={styles.heroTitleRow}>
          <View style={styles.overviewTitleWrap}>
            <MaterialCommunityIcons name="view-dashboard-outline" size={18} color="rgba(255,255,255,0.8)" style={{ marginRight: 6 }} />
            <Text style={styles.heroTitle}>Overview</Text>
          </View>
          <View style={styles.yearPicker}>
            <TouchableOpacity
              onPress={() => setSelectedYear((y) => Math.max(2000, y - 1))}
              disabled={selectedYear <= 2000}
              style={styles.yearArrow}
            >
              <MaterialCommunityIcons name="chevron-left" size={20} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
            <Text style={styles.yearText}>{selectedYear}</Text>
            <TouchableOpacity
              onPress={() => setSelectedYear((y) => Math.min(currentYear, y + 1))}
              disabled={selectedYear >= currentYear}
              style={styles.yearArrow}
            >
              <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.overviewDivider} />

        {/* Property selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.selectorRow}
          contentContainerStyle={styles.selectorContent}
        >
          {properties.map((p) => {
            const active = p.id === selectedPropertyId;
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.overviewChip,
                  active && styles.overviewChipActive,
                ]}
                onPress={() => selectProperty(p.id)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name="home-city"
                  size={13}
                  color={active ? '#fff' : 'rgba(255,255,255,0.65)'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.overviewChipText, active && styles.overviewChipTextActive]}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Tenant selector */}
        {tenantsForProperty.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.selectorRow}
            contentContainerStyle={styles.selectorContent}
          >
            {tenantsForProperty.map((t) => {
              const active = t.tenantId === selectedTenantId;
              const monthStatus = t.paymentsByMonth[currentMonth]?.status ?? null;
              const dotColor = monthStatus ? getStatusColor(monthStatus) : 'rgba(255,255,255,0.4)';
              return (
                <TouchableOpacity
                  key={t.tenantId}
                  style={[
                    styles.overviewChip,
                    active && styles.overviewChipActive,
                  ]}
                  onPress={() => setSelectedTenantId(t.tenantId)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                  <Text style={[styles.overviewChipText, active && styles.overviewChipTextActive]}>
                    {t.tenantName}
                  </Text>
                  <Text style={[styles.overviewChipSub, active && { color: 'rgba(255,255,255,0.85)' }]}>
                    {' '}· {t.flatNo}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Payment grid */}
        <View style={styles.overviewGrid}>
          {MONTHS.map((m) => {
            const payment = selectedRow?.paymentsByMonth[m];
            const status: PaymentStatus | null = payment?.status ?? null;
            const isCurrentMonth = m === currentMonth && selectedYear === currentYear;
            const isFuture =
              selectedYear > currentYear ||
              (selectedYear === currentYear && m > currentMonth);

            const bgColor = isFuture
              ? 'rgba(255,255,255,0.05)'
              : status
              ? getStatusColor(status) + '40'
              : 'rgba(255,255,255,0.12)';
            const dotColor = status
              ? getStatusColor(status)
              : isFuture
              ? 'rgba(255,255,255,0.18)'
              : 'rgba(255,255,255,0.35)';
            const labelColor = isFuture
              ? 'rgba(255,255,255,0.3)'
              : status
              ? '#fff'
              : 'rgba(255,255,255,0.6)';
            const canNavigate = !!payment?.id;

            return (
              <TouchableOpacity
                key={m}
                disabled={!canNavigate}
                onPress={() => {
                  if (canNavigate && selectedRow) {
                    router.push(
                      `/property/${selectedRow.propertyId}/tenant/${selectedRow.tenantId}/payment/${payment!.id}`,
                    );
                  }
                }}
                style={[
                  styles.overviewMonthChip,
                  { backgroundColor: bgColor },
                  isCurrentMonth && { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' },
                ]}
              >
                <Text style={[styles.overviewMonthLabel, { color: labelColor }]}>
                  {MONTH_SHORT[m - 1]}
                </Text>
                <View style={[styles.overviewStatusDot, { backgroundColor: dotColor }]} />
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>
      {/* End overview section */}

      {/* Telegram CTA */}
      {!telegramLinked && (
        <TouchableOpacity
          onPress={handleLinkTelegram}
          disabled={linkingTelegram}
          activeOpacity={0.85}
          style={{ marginTop: 10 }}
        >
          <LinearGradient
            colors={['#FBBF24', '#F59E0B']}
            style={styles.telegramCta}
          >
            <View style={styles.telegramCtaTop}>
              <View style={styles.telegramCtaIcon}>
                <MaterialCommunityIcons name="robot-happy-outline" size={20} color="#78350F" />
              </View>
              <View style={styles.telegramCtaTextWrap}>
                <Text style={styles.telegramCtaTitle}>
                  {linkingTelegram ? 'Opening Telegram…' : 'Link Telegram to meet your AI assistant!'}
                </Text>
                <Text style={styles.telegramCtaSub}>You command, the AI executes</Text>
              </View>
            </View>
            <View style={styles.telegramCtaChips}>
              <View style={styles.telegramCtaChip}><Text style={styles.telegramCtaChipText}>Log Rent</Text></View>
              <View style={styles.telegramCtaChip}><Text style={styles.telegramCtaChipText}>Send Reminders</Text></View>
              <View style={styles.telegramCtaChip}><Text style={styles.telegramCtaChipText}>Add a Property</Text></View>
              <View style={styles.telegramCtaChip}><Text style={styles.telegramCtaChipText}>Check Payments</Text></View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Log Payment shortcut */}
      <GradientButton
        title="Log Payment"
        icon="plus-circle-outline"
        onPress={() => {
          if (selectedRow) {
            router.push(`/log-payment?propertyId=${selectedRow.propertyId}&tenantId=${selectedRow.tenantId}`);
          } else {
            router.push('/log-payment');
          }
        }}
        style={{ marginTop: 10 }}
      />

      {/* Send Reminders shortcut */}
      <GradientButton
        title="Send Reminders"
        icon="bell-ring-outline"
        variant="secondary"
        onPress={() => router.push('/reminders')}
        style={{ marginTop: 8 }}
      />

      {/* AI Nudge */}
      <AiInsightCard nudge={aiNudge} loading={aiNudgeLoading} />

      {/* Section 2 — Monthly Summary (expandable) */}
      <GlassCard variant="default" style={{ padding: 12, gap: 12, marginTop: 24 }}>
        <TouchableOpacity
          style={styles.summaryToggle}
          onPress={() => setSummaryExpanded((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={styles.summaryToggleLeft}>
            <MaterialCommunityIcons name="chart-bar" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.summaryToggleText, { color: colors.textPrimary }]}>Monthly Summary</Text>
          </View>
          <View style={styles.summaryToggleRight}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                if (summaryMonth <= 1) {
                  setSummaryMonth(12);
                  setSelectedYear((y) => Math.max(2000, y - 1));
                } else {
                  setSummaryMonth((m) => m - 1);
                }
              }}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.summaryMonthText, { color: colors.textSecondary }]}>
              {MONTH_SHORT[summaryMonth - 1]} {selectedYear}
            </Text>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                if (summaryMonth >= 12) {
                  setSummaryMonth(1);
                  setSelectedYear((y) => Math.min(currentYear, y + 1));
                } else {
                  setSummaryMonth((m) => m + 1);
                }
              }}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <MaterialCommunityIcons
              name={summaryExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
              style={{ marginLeft: 8 }}
            />
          </View>
        </TouchableOpacity>

        {summaryExpanded && (
          <>
            <AnimatedCard index={0}>
              <View style={styles.statsGrid}>
                <StatCard label="Total Receivable" value={stats.totalReceivable} color={colors.primary} surfaceBg={colors.surfaceElevated} secondaryText={colors.textSecondary} />
                <StatCard label="Received" value={stats.totalReceived} color={colors.statusConfirmed} surfaceBg={colors.surfaceElevated} secondaryText={colors.textSecondary} />
                <StatCard label="Yet to Receive" value={stats.totalPending} color={colors.statusPartial} surfaceBg={colors.surfaceElevated} secondaryText={colors.textSecondary} />
                <StatCard label="Overdue" value={stats.totalOverdue} color={colors.statusOverdue} surfaceBg={colors.surfaceElevated} secondaryText={colors.textSecondary} />
              </View>
            </AnimatedCard>

            {/* P&L card */}
            <View style={[styles.plCard, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.plTitle, { color: colors.textSecondary }]}>
                P&L — {getMonthName(summaryMonth)} {selectedYear}
              </Text>
              <View style={styles.plRow}>
                <View style={styles.plItem}>
                  <Text style={[styles.plValue, { color: colors.statusConfirmed }]}>
                    {formatCurrency(stats.totalReceived)}
                  </Text>
                  <Text style={[styles.plLabel, { color: colors.textSecondary }]}>Income</Text>
                </View>
                <View style={[styles.plDivider, { backgroundColor: colors.border }]} />
                <View style={styles.plItem}>
                  <Text style={[styles.plValue, { color: colors.error }]}>
                    {formatCurrency(monthlyExpenses)}
                  </Text>
                  <Text style={[styles.plLabel, { color: colors.textSecondary }]}>Expenses</Text>
                </View>
                <View style={[styles.plDivider, { backgroundColor: colors.border }]} />
                <View style={styles.plItem}>
                  <Text
                    style={[
                      styles.plValue,
                      { color: stats.totalReceived - monthlyExpenses >= 0 ? colors.statusConfirmed : colors.error },
                    ]}
                  >
                    {formatCurrency(stats.totalReceived - monthlyExpenses)}
                  </Text>
                  <Text style={[styles.plLabel, { color: colors.textSecondary }]}>Net</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </GlassCard>

      {/* Section 3 — Recent Transactions */}
      {recentTransactions.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 24, color: colors.textPrimary }]}>Recent Transactions</Text>
          {recentTransactions.map((tx, index) => (
            <AnimatedCard key={tx.paymentId} index={index + 4}>
            <TouchableOpacity
              style={[styles.txCard, shadows.sm, { backgroundColor: colors.surface }]}
              onPress={() =>
                router.push(
                  `/property/${tx.propertyId}/tenant/${tx.tenantId}/payment/${tx.paymentId}`,
                )
              }
            >
              <View style={[styles.txAccent, { backgroundColor: getStatusColor(tx.status) }]} />
              <View style={[styles.txRow, { paddingLeft: 17 }]}>
                <View style={styles.txLeft}>
                  <Text style={[styles.txTenant, { color: colors.textPrimary }]}>
                    {tx.tenantName} · Flat {tx.flatNo}
                  </Text>
                  <Text style={[styles.txSub, { color: colors.textSecondary }]}>
                    {tx.propertyName} · {getMonthName(tx.month)} {tx.year}
                  </Text>
                  <Text style={[styles.txDate, { color: colors.textDisabled }]}>Paid: {formatDate(tx.paidAt)}</Text>
                </View>
                <View style={styles.txRight}>
                  <Text style={[styles.txAmount, { color: colors.textPrimary }]}>{formatCurrency(tx.amountPaid)}</Text>
                  <PaymentStatusBadge status={tx.status} />
                </View>
              </View>
            </TouchableOpacity>
            </AnimatedCard>
          ))}
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
    padding: 16,
    paddingTop: 0,
    paddingBottom: 40,
  },
  inlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    marginHorizontal: -16,
    marginBottom: 16,
  },
  // Overview card (replaces heroCard)
  overviewCard: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
    overflow: 'hidden',
  },
  // Design 6: bold arc + accent dot
  overviewDecorArc: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'transparent',
    bottom: -200,
    left: -80,
  },
  overviewDecorArcInner: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'transparent',
    bottom: -150,
    left: -30,
  },
  overviewDecorAccent: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    top: 18,
    right: 56,
  },
  overviewTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: -2,
  },
  overviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  overviewChipActive: {
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  overviewChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.65)',
  },
  overviewChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  overviewChipSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
    marginHorizontal: 0,
  },
  overviewMonthChip: {
    width: OVERVIEW_CHIP_W,
    height: OVERVIEW_CHIP_H,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  overviewMonthLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  overviewMonthSub: {
    fontSize: 10,
    marginTop: 3,
    fontWeight: '600',
  },
  overviewStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 4,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  yearPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  yearArrow: {
    padding: 4,
  },
  yearText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    marginHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  // Selector rows
  selectorRow: {},
  selectorContent: {
    gap: 8,
    paddingRight: 4,
  },
  selectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  selectorChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  selectorChipSub: {
    fontSize: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  monthChip: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    borderRadius: CHIP_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  currentDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  monthChipLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  monthChipSub: {
    fontSize: 9,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  // Telegram CTA
  telegramCta: {
    borderRadius: 16,
    padding: 14,
  },
  telegramCtaTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  telegramCtaIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  telegramCtaTextWrap: {
    flex: 1,
  },
  telegramCtaTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#78350F',
  },
  telegramCtaSub: {
    fontSize: 12,
    color: 'rgba(120,53,15,0.7)',
    marginTop: 2,
  },
  telegramCtaChips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  telegramCtaChip: {
    backgroundColor: 'rgba(120,53,15,0.15)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  telegramCtaChipText: {
    color: '#78350F',
    fontSize: 10,
    fontWeight: '600',
  },
  // Summary toggle
  summaryToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryToggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryToggleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  summaryMonthText: {
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 4,
    minWidth: 70,
    textAlign: 'center',
  },
  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 16,
    padding: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  statAccent: {
    position: 'absolute',
    width: 3,
    left: 0,
    top: 8,
    bottom: 8,
    borderRadius: 2,
  },
  statIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    opacity: 0.4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
    paddingLeft: 12,
  },
  statLabel: {
    fontSize: 12,
    paddingLeft: 12,
  },
  // P&L
  plCard: {
    borderRadius: 14,
    padding: 16,
  },
  plTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  plRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plItem: {
    flex: 1,
    alignItems: 'center',
  },
  plValue: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  plLabel: {
    fontSize: 11,
  },
  plDivider: {
    width: 1,
    height: 32,
  },
  // Transactions
  txCard: {
    borderRadius: 14,
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  txAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
  },
  txLeft: {
    flex: 1,
    marginRight: 12,
  },
  txRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  txTenant: {
    fontSize: 14,
    fontWeight: '600',
  },
  txSub: {
    fontSize: 12,
    marginTop: 2,
  },
  txDate: {
    fontSize: 11,
    marginTop: 4,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
});
