import { useState, useCallback, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useDashboard, TenantRow } from '@/hooks/useDashboard';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { ErrorBanner } from '@/components/ErrorBanner';
import { AnimatedCard } from '@/components/AnimatedCard';
import { Colors, Shadows } from '@/constants/colors';
import { formatCurrency, formatDate, getMonthName, getCurrentMonthYear } from '@/lib/utils';
import { getStatusColor } from '@/lib/payments';
import { PaymentStatus } from '@/lib/types';
import { supabase } from '@/lib/supabase';

const SCREEN_W = Dimensions.get('window').width;
// 4-col grid: outer padding 32, block padding 24, 3 gaps of 4px
// 6 circles per row, 2 rows = 12 months
// Total horizontal space used: 6 * CHIP_SIZE + 5 gaps
// Available: SCREEN_W - screen padding (32) - tenantBlock padding (24) - 5 gaps (20)
const CHIP_SIZE = Math.floor((SCREEN_W - 32 - 24 - 20) / 6);

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

interface StatCardProps { label: string; value: number; color: string }

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <View style={[styles.statCard, Shadows.md]}>
      <View style={[styles.statAccent, { backgroundColor: color }]} />
      <MaterialCommunityIcons
        name={STAT_ICONS[label] as any}
        size={18}
        color={color}
        style={styles.statIcon}
      />
      <Text style={[styles.statValue, { color }]}>{formatCurrency(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { tenantRows, stats, recentTransactions, isLoading, error, refresh } = useDashboard(selectedYear);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);


  useEffect(() => {
    async function fetchMonthlyExpenses() {
      const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
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
  }, [currentMonth, currentYear]);

  // Derive unique properties from tenant rows
  const properties = [
    ...new Map(
      tenantRows.map((r) => [r.propertyId, { id: r.propertyId, name: r.propertyName }])
    ).values(),
  ];

  // Tenants for the selected property
  const tenantsForProperty = tenantRows.filter((r) => r.propertyId === selectedPropertyId);

  // Auto-select first property and first tenant when data loads
  useEffect(() => {
    if (tenantRows.length === 0) return;
    if (!selectedPropertyId) {
      const firstProp = tenantRows[0].propertyId;
      setSelectedPropertyId(firstProp);
      setSelectedTenantId(tenantRows.find((r) => r.propertyId === firstProp)?.tenantId ?? null);
    }
  }, [tenantRows]);

  // When property changes, auto-select first tenant of that property
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
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ErrorBanner error={error} onRetry={refresh} />

      {/* Hero gradient header */}
      <LinearGradient
        colors={Colors.gradientHero as [string, string]}
        style={[styles.heroCard, Shadows.hero]}
      >
        <View style={styles.heroTitleRow}>
          <Text style={styles.heroTitle}>Overview</Text>
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
      </LinearGradient>

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
              style={[styles.selectorChip, active && styles.selectorChipActive]}
              onPress={() => selectProperty(p.id)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="home-city"
                size={13}
                color={active ? Colors.primary : Colors.textSecondary}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.selectorChipText, active && styles.selectorChipTextActive]}>
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
            const dotColor = monthStatus ? getStatusColor(monthStatus) : Colors.textDisabled;
            return (
              <TouchableOpacity
                key={t.tenantId}
                style={[styles.selectorChip, active && styles.selectorChipActive]}
                onPress={() => setSelectedTenantId(t.tenantId)}
                activeOpacity={0.7}
              >
                <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                <Text style={[styles.selectorChipText, active && styles.selectorChipTextActive]}>
                  {t.tenantName}
                </Text>
                <Text style={[styles.selectorChipSub, active && { color: Colors.primary }]}>
                  {' '}· {t.flatNo}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Payment grid — always shown */}
      <View style={[styles.tenantBlock, Shadows.sm]}>
        <View style={styles.monthGrid}>
          {MONTHS.map((m) => {
            const payment = selectedRow?.paymentsByMonth[m];
            const status: PaymentStatus | null = payment?.status ?? null;
            const isCurrentMonth = m === currentMonth;

            const bgColor = status ? getStatusColor(status) + '22' : Colors.statusPendingSoft;
            const iconColor = status ? getStatusColor(status) : Colors.statusPending;
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
                  styles.monthChip,
                  { backgroundColor: bgColor },
                  isCurrentMonth && styles.monthChipCurrent,
                ]}
              >
                {isCurrentMonth && <View style={styles.currentDot} />}
                <Text style={[styles.monthChipLabel, { color: iconColor }]}>
                  {MONTH_SHORT[m - 1]}
                </Text>
                {status ? (
                  <MaterialCommunityIcons
                    name={STATUS_ICON[status] as any}
                    size={12}
                    color={iconColor}
                    style={{ marginTop: 2 }}
                  />
                ) : (
                  <Text style={[styles.monthChipSub, { color: iconColor }]}>—</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Log Payment shortcut — always shown */}
      <TouchableOpacity
        style={[styles.logPaymentBtn, Shadows.sm]}
        onPress={() => {
          if (selectedRow) {
            router.push(`/log-payment?propertyId=${selectedRow.propertyId}&tenantId=${selectedRow.tenantId}`);
          } else {
            router.push('/property/create');
          }
        }}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.logPaymentBtnText}>{selectedRow ? 'Log Payment' : 'Add a Property to Start'}</Text>
      </TouchableOpacity>

      {/* Send Reminders shortcut */}
      <TouchableOpacity
        style={styles.remindersBtn}
        onPress={() => router.push('/reminders')}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="bell-ring-outline" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
        <Text style={styles.remindersBtnText}>Send Reminders</Text>
      </TouchableOpacity>

      {/* Section 2 — Stats */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
        {getMonthName(currentMonth)} {selectedYear}
      </Text>
      <View style={styles.statsGrid}>
        <AnimatedCard index={0} style={{ flex: 1, minWidth: '45%' }}>
          <StatCard label="Total Receivable" value={stats.totalReceivable} color={Colors.primary} />
        </AnimatedCard>
        <AnimatedCard index={1} style={{ flex: 1, minWidth: '45%' }}>
          <StatCard label="Received" value={stats.totalReceived} color={Colors.statusConfirmed} />
        </AnimatedCard>
        <AnimatedCard index={2} style={{ flex: 1, minWidth: '45%' }}>
          <StatCard label="Yet to Receive" value={stats.totalPending} color={Colors.statusPartial} />
        </AnimatedCard>
        <AnimatedCard index={3} style={{ flex: 1, minWidth: '45%' }}>
          <StatCard label="Overdue" value={stats.totalOverdue} color={Colors.statusOverdue} />
        </AnimatedCard>
      </View>

      {/* P&L card */}
      <View style={[styles.plCard, Shadows.sm]}>
        <Text style={styles.plTitle}>
          P&L — {getMonthName(currentMonth)} {selectedYear}
        </Text>
        <View style={styles.plRow}>
          <View style={styles.plItem}>
            <Text style={[styles.plValue, { color: Colors.statusConfirmed }]}>
              {formatCurrency(stats.totalReceived)}
            </Text>
            <Text style={styles.plLabel}>Income</Text>
          </View>
          <View style={styles.plDivider} />
          <View style={styles.plItem}>
            <Text style={[styles.plValue, { color: Colors.error }]}>
              {formatCurrency(monthlyExpenses)}
            </Text>
            <Text style={styles.plLabel}>Expenses</Text>
          </View>
          <View style={styles.plDivider} />
          <View style={styles.plItem}>
            <Text
              style={[
                styles.plValue,
                { color: stats.totalReceived - monthlyExpenses >= 0 ? Colors.statusConfirmed : Colors.error },
              ]}
            >
              {formatCurrency(stats.totalReceived - monthlyExpenses)}
            </Text>
            <Text style={styles.plLabel}>Net</Text>
          </View>
        </View>
      </View>

      {/* Section 3 — Recent Transactions */}
      {recentTransactions.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Transactions</Text>
          {recentTransactions.map((tx, index) => (
            <AnimatedCard key={tx.paymentId} index={index + 4}>
            <TouchableOpacity
              style={[styles.txCard, Shadows.sm]}
              onPress={() =>
                router.push(
                  `/property/${tx.propertyId}/tenant/${tx.tenantId}/payment/${tx.paymentId}`,
                )
              }
            >
              <View style={[styles.txAccent, { backgroundColor: getStatusColor(tx.status) }]} />
              <View style={[styles.txRow, { paddingLeft: 17 }]}>
                <View style={styles.txLeft}>
                  <Text style={styles.txTenant}>
                    {tx.tenantName} · Flat {tx.flatNo}
                  </Text>
                  <Text style={styles.txSub}>
                    {tx.propertyName} · {getMonthName(tx.month)} {tx.year}
                  </Text>
                  <Text style={styles.txDate}>Paid: {formatDate(tx.paidAt)}</Text>
                </View>
                <View style={styles.txRight}>
                  <Text style={styles.txAmount}>{formatCurrency(tx.amountPaid)}</Text>
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
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },

  // Hero
  heroCard: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
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
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  // Selector rows
  selectorRow: {
    marginBottom: 8,
  },
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
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  selectorChipActive: {
    borderColor: Colors.primaryMid,
    backgroundColor: Colors.primarySoft,
  },
  selectorChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  selectorChipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  selectorChipSub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  // Tenant payment block
  tenantBlock: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 4,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  monthChip: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    borderRadius: CHIP_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  monthChipCurrent: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  currentDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
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
  // Buttons
  logPaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  logPaymentBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  remindersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  remindersBtnText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
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
    color: Colors.textSecondary,
    paddingLeft: 12,
  },
  // P&L
  plCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  plTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
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
    color: Colors.textSecondary,
  },
  plDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },
  // Transactions
  txCard: {
    backgroundColor: Colors.surface,
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
    gap: 6,
  },
  txTenant: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  txSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  txDate: {
    fontSize: 11,
    color: Colors.textDisabled,
    marginTop: 4,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
