import { useState, useCallback, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useDashboard, TenantRow } from '@/hooks/useDashboard';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { Colors } from '@/constants/colors';
import { formatCurrency, formatDate, getMonthName, getCurrentMonthYear } from '@/lib/utils';
import { getStatusColor } from '@/lib/payments';
import { PaymentStatus } from '@/lib/types';

const SCREEN_W = Dimensions.get('window').width;
// outer padding 32, block padding 24, 5 gaps of 4px between 6 chips
const CHIP_W = Math.floor((SCREEN_W - 32 - 24 - 20) / 6);

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{formatCurrency(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { tenantRows, stats, recentTransactions, isLoading, refresh } = useDashboard();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();

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
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (tenantRows.length === 0) {
    return (
      <EmptyState
        icon="view-dashboard-outline"
        title="No tenants yet"
        subtitle="Add properties and tenants to see your dashboard."
      />
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Section 1 — Payment Status with selectors */}
      <Text style={styles.sectionTitle}>Payment Status — {currentYear}</Text>

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

      {/* Payment grid for selected tenant */}
      {selectedRow ? (
        <View style={styles.tenantBlock}>
          <View style={styles.monthGrid}>
            {MONTHS.map((m) => {
              const payment = selectedRow.paymentsByMonth[m];
              const status: PaymentStatus | null = payment?.status ?? null;
              const isCurrentMonth = m === currentMonth;

              const bgColor = status ? getStatusColor(status) + '22' : Colors.statusPending + '22';
              const textColor = status ? getStatusColor(status) : Colors.statusPending;
              const canNavigate = !!payment?.id;

              return (
                <TouchableOpacity
                  key={m}
                  disabled={!canNavigate}
                  onPress={() => {
                    if (canNavigate) {
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
                  <Text style={[styles.monthChipLabel, { color: textColor }]}>
                    {MONTH_SHORT[m - 1]}
                  </Text>
                  <Text style={[styles.monthChipSub, { color: textColor }]}>
                    {status ? status.slice(0, 3) : '—'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Section 2 — Stats (global, all tenants) */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
        {getMonthName(currentMonth)} {currentYear}
      </Text>
      <View style={styles.statsGrid}>
        <StatCard label="Total Receivable" value={stats.totalReceivable} color={Colors.primary} />
        <StatCard label="Received" value={stats.totalReceived} color={Colors.statusConfirmed} />
        <StatCard label="Yet to Receive" value={stats.totalPending} color={Colors.statusPartial} />
        <StatCard label="Overdue" value={stats.totalOverdue} color={Colors.statusOverdue} />
      </View>

      {/* Section 3 — Recent Transactions */}
      {recentTransactions.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Transactions</Text>
          {recentTransactions.map((tx) => (
            <TouchableOpacity
              key={tx.paymentId}
              style={styles.txCard}
              onPress={() =>
                router.push(
                  `/property/${tx.propertyId}/tenant/${tx.tenantId}/payment/${tx.paymentId}`,
                )
              }
            >
              <View style={styles.txRow}>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
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
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '12',
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
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  monthChip: {
    borderRadius: 8,
    paddingVertical: 6,
    width: CHIP_W,
    alignItems: 'center',
  },
  monthChipCurrent: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
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
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  // Transactions
  txCard: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
