import { useState, useCallback } from 'react';
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

const SCREEN_W = Dimensions.get('window').width;
// outer padding 32, block padding 24, 5 gaps of 4px between 6 chips
const CHIP_W = Math.floor((SCREEN_W - 32 - 24 - 20) / 6);
import { useRouter } from 'expo-router';
import { Menu } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useDashboard, TenantRow } from '@/hooks/useDashboard';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { Colors } from '@/constants/colors';
import { formatCurrency, formatDate, getMonthName, getCurrentMonthYear } from '@/lib/utils';
import { getStatusColor } from '@/lib/payments';
import { PaymentStatus } from '@/lib/types';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type SortKey = 'name' | 'property' | 'overdue';

const STATUS_ORDER: Record<PaymentStatus, number> = {
  overdue: 0,
  pending: 1,
  partial: 2,
  paid: 3,
  confirmed: 4,
};

function worstStatus(row: TenantRow): number {
  const { month } = getCurrentMonthYear();
  const p = row.paymentsByMonth[month];
  if (!p) return 1;
  return STATUS_ORDER[p.status];
}

function sortRows(rows: TenantRow[], key: SortKey): TenantRow[] {
  const copy = [...rows];
  if (key === 'name') {
    copy.sort((a, b) => a.tenantName.localeCompare(b.tenantName));
  } else if (key === 'property') {
    copy.sort((a, b) => a.propertyName.localeCompare(b.propertyName));
  } else {
    copy.sort((a, b) => worstStatus(a) - worstStatus(b));
  }
  return copy;
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
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
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [menuVisible, setMenuVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [refresh]);

  const sortedRows = sortRows(tenantRows, sortKey);

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
      {/* Section 1 — Payment Grid (hero) */}
      <View style={styles.gridHeader}>
        <Text style={styles.sectionTitle}>Payment Status — {currentYear}</Text>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <TouchableOpacity style={styles.sortBtn} onPress={() => setMenuVisible(true)}>
              <MaterialCommunityIcons name="sort" size={16} color={Colors.primary} />
              <Text style={styles.sortBtnText}>Sort</Text>
            </TouchableOpacity>
          }
        >
          <Menu.Item
            onPress={() => { setSortKey('name'); setMenuVisible(false); }}
            title="Tenant Name (A→Z)"
            leadingIcon={sortKey === 'name' ? 'check' : undefined}
          />
          <Menu.Item
            onPress={() => { setSortKey('property'); setMenuVisible(false); }}
            title="Property"
            leadingIcon={sortKey === 'property' ? 'check' : undefined}
          />
          <Menu.Item
            onPress={() => { setSortKey('overdue'); setMenuVisible(false); }}
            title="Overdue First"
            leadingIcon={sortKey === 'overdue' ? 'check' : undefined}
          />
        </Menu>
      </View>

      {sortedRows.map((row) => (
        <View key={row.tenantId} style={styles.tenantBlock}>
          <View style={styles.tenantMeta}>
            <Text style={styles.tenantName}>{row.tenantName}</Text>
            <Text style={styles.tenantSub}>
              Flat {row.flatNo} · {row.propertyName}
            </Text>
          </View>
          <View style={styles.monthGrid}>
            {MONTHS.map((m) => {
              const payment = row.paymentsByMonth[m];
              const status: PaymentStatus | null = payment?.status ?? null;
              const isCurrentMonth = m === currentMonth;

              let bgColor = Colors.statusPending + '22';
              let textColor = Colors.statusPending;

              if (status) {
                bgColor = getStatusColor(status) + '22';
                textColor = getStatusColor(status);
              }

              const canNavigate = !!payment?.id;

              return (
                <TouchableOpacity
                  key={m}
                  disabled={!canNavigate}
                  onPress={() => {
                    if (canNavigate) {
                      router.push(
                        `/property/${row.propertyId}/tenant/${row.tenantId}/payment/${payment!.id}`,
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
      ))}

      {/* Section 2 — Stats */}
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
    marginBottom: 12,
  },
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
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortBtnText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  tenantBlock: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  tenantMeta: {
    marginBottom: 8,
  },
  tenantName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  tenantSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
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
