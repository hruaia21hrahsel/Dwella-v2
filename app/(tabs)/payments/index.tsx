import { useState, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Modal, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useProperties } from '@/hooks/useProperties';
import { Payment, PaymentStatus } from '@/lib/types';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, getMonthName, getCurrentMonthYear } from '@/lib/utils';
import { getStatusColor } from '@/lib/payments';
import { ListSkeleton } from '@/components/ListSkeleton';
import { AnimatedCard } from '@/components/AnimatedCard';

// ── Types ──

interface TenantOption {
  id: string;
  tenant_name: string;
  flat_no: string;
  property_id: string;
  monthly_rent: number;
}

interface PropertyOption {
  id: string;
  name: string;
}

interface PaymentRow extends Payment {
  tenant_name: string;
  flat_no: string;
  property_name: string;
}

type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'status';

const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
  { key: 'date_desc', label: 'Newest First', icon: 'sort-calendar-descending' },
  { key: 'date_asc', label: 'Oldest First', icon: 'sort-calendar-ascending' },
  { key: 'amount_desc', label: 'Amount (High → Low)', icon: 'sort-numeric-descending' },
  { key: 'amount_asc', label: 'Amount (Low → High)', icon: 'sort-numeric-ascending' },
  { key: 'status', label: 'Status', icon: 'sort-variant' },
];

const STATUS_ORDER: Record<PaymentStatus, number> = {
  overdue: 0,
  pending: 1,
  partial: 2,
  paid: 3,
  confirmed: 4,
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PaymentsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const { ownedProperties } = useProperties();
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
  const loadedRef = useRef(false);

  const [allTenants, setAllTenants] = useState<TenantOption[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterPropertyId, setFilterPropertyId] = useState<string | null>(null);
  const [filterTenantId, setFilterTenantId] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState<number | null>(currentMonth);
  const [filterYear, setFilterYear] = useState<number>(currentYear);

  const [sortKey, setSortKey] = useState<SortKey>('date_desc');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [periodPickerVisible, setPeriodPickerVisible] = useState(false);

  const isLandlord = ownedProperties.length > 0;

  const properties: PropertyOption[] = useMemo(
    () => ownedProperties.map((p) => ({ id: p.id, name: p.name })),
    [ownedProperties],
  );

  const tenantsForFilter = useMemo(
    () => (filterPropertyId ? allTenants.filter((t) => t.property_id === filterPropertyId) : allTenants),
    [allTenants, filterPropertyId],
  );

  useEffect(() => {
    if (!user?.id || !isLandlord || loadedRef.current) return;
    loadedRef.current = true;
    loadData();
  }, [user?.id, isLandlord]);

  async function loadData() {
    setLoading(true);

    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id, tenant_name, flat_no, property_id, monthly_rent')
      .in('property_id', ownedProperties.map((p) => p.id))
      .eq('is_archived', false)
      .order('tenant_name');

    const tenants: TenantOption[] = tenantData ?? [];
    setAllTenants(tenants);

    const { data: paymentData } = await supabase
      .from('payments')
      .select('*, tenants!inner(tenant_name, flat_no, property_id, properties!inner(name))')
      .in('property_id', ownedProperties.map((p) => p.id))
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    const payments: PaymentRow[] = (paymentData ?? []).map((p: any) => ({
      ...p,
      tenant_name: p.tenants?.tenant_name ?? '—',
      flat_no: p.tenants?.flat_no ?? '—',
      property_name: p.tenants?.properties?.name ?? '—',
      tenants: undefined,
    }));

    setAllPayments(payments);
    setLoading(false);
  }

  async function handleRefresh() {
    loadedRef.current = false;
    await loadData();
  }

  const filteredPayments = useMemo(() => {
    let result = allPayments;
    if (filterPropertyId) result = result.filter((p) => p.property_id === filterPropertyId);
    if (filterTenantId) result = result.filter((p) => p.tenant_id === filterTenantId);
    if (filterMonth !== null) result = result.filter((p) => p.month === filterMonth);
    result = result.filter((p) => p.year === filterYear);
    return result;
  }, [allPayments, filterPropertyId, filterTenantId, filterMonth, filterYear]);

  const sortedPayments = useMemo(() => {
    const arr = [...filteredPayments];
    switch (sortKey) {
      case 'date_desc': return arr.sort((a, b) => b.year - a.year || b.month - a.month);
      case 'date_asc': return arr.sort((a, b) => a.year - b.year || a.month - b.month);
      case 'amount_desc': return arr.sort((a, b) => b.amount_paid - a.amount_paid);
      case 'amount_asc': return arr.sort((a, b) => a.amount_paid - b.amount_paid);
      case 'status': return arr.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
      default: return arr;
    }
  }, [filteredPayments, sortKey]);

  const summaryStats = useMemo(() => {
    const total = filteredPayments.reduce((s, p) => s + p.amount_due, 0);
    const collected = filteredPayments.reduce((s, p) => s + p.amount_paid, 0);
    const overdue = filteredPayments.filter((p) => p.status === 'overdue').length;
    return { total, collected, outstanding: total - collected, overdue, count: filteredPayments.length };
  }, [filteredPayments]);

  function selectProperty(propId: string | null) {
    setFilterPropertyId(propId);
    setFilterTenantId(null);
  }

  if (loading) return <ListSkeleton count={5} />;

  if (!isLandlord) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState icon="receipt" title="No payments yet" subtitle="Add properties and tenants to start tracking payments." />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {/* Filters */}
        <View style={styles.filterSection}>
          <View style={styles.titleRow}>
            <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Payment History</Text>
            <TouchableOpacity
              style={[styles.periodBtn, { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
              onPress={() => setPeriodPickerVisible(true)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="calendar-month-outline" size={16} color={colors.primary} />
              <Text style={[styles.periodBtnText, { color: colors.primary }]}>
                {filterMonth !== null ? `${MONTH_SHORT[filterMonth - 1]} ${filterYear}` : `All ${filterYear}`}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Property filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }, !filterPropertyId && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
              onPress={() => selectProperty(null)}
              activeOpacity={0.7}
            >
              <Text style={[{ fontSize: 13, fontWeight: '500', color: colors.textSecondary }, !filterPropertyId && { color: colors.primary, fontWeight: '700' }]}>All Properties</Text>
            </TouchableOpacity>
            {properties.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface, marginLeft: 8 }, filterPropertyId === p.id && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
                onPress={() => selectProperty(p.id)}
                activeOpacity={0.7}
              >
                <Text style={[{ fontSize: 13, fontWeight: '500', color: colors.textSecondary }, filterPropertyId === p.id && { color: colors.primary, fontWeight: '700' }]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Tenant filter */}
          {filterPropertyId && tenantsForFilter.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }, !filterTenantId && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
                onPress={() => setFilterTenantId(null)}
                activeOpacity={0.7}
              >
                <Text style={[{ fontSize: 13, fontWeight: '500', color: colors.textSecondary }, !filterTenantId && { color: colors.primary, fontWeight: '700' }]}>All Tenants</Text>
              </TouchableOpacity>
              {tenantsForFilter.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface, marginLeft: 8 }, filterTenantId === t.id && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
                  onPress={() => setFilterTenantId(t.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[{ fontSize: 13, fontWeight: '500', color: colors.textSecondary }, filterTenantId === t.id && { color: colors.primary, fontWeight: '700' }]}>
                    {t.tenant_name}
                  </Text>
                  <Text style={[{ fontSize: 12, color: colors.textSecondary }, filterTenantId === t.id && { color: colors.primary }]}>
                    {' · '}{t.flat_no}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border, borderTopColor: colors.primary }]}>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>{formatCurrency(summaryStats.total)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Due</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border, borderTopColor: colors.statusConfirmed }]}>
            <Text style={[styles.summaryValue, { color: colors.statusConfirmed }]}>{formatCurrency(summaryStats.collected)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Collected</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border, borderTopColor: colors.statusOverdue }]}>
            <Text style={[styles.summaryValue, { color: colors.statusOverdue }]}>{formatCurrency(summaryStats.outstanding)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Outstanding</Text>
          </View>
        </View>

        {/* Results header */}
        <View style={styles.resultsHeader}>
          <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
            {summaryStats.count} payment{summaryStats.count !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity
            style={[styles.sortBtn, { borderColor: colors.primary }]}
            onPress={() => setSortModalVisible(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="sort-variant" size={16} color={colors.primary} />
            <Text style={[styles.sortBtnText, { color: colors.primary }]}>Sort</Text>
          </TouchableOpacity>
        </View>

        {/* Payment list */}
        {sortedPayments.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="cash-remove" size={28} color={colors.textDisabled} />
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>No payments found for this filter</Text>
          </View>
        ) : (
          sortedPayments.map((p, index) => (
            <AnimatedCard key={p.id} index={index}>
              <TouchableOpacity
                style={[styles.paymentRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push(`/property/${p.property_id}/tenant/${p.tenant_id}/payment/${p.id}`)}
                activeOpacity={0.7}
              >
                <View style={[styles.paymentAccent, { backgroundColor: getStatusColor(p.status) }]} />
                <View style={styles.paymentRowInner}>
                  <View style={styles.paymentInfo}>
                    <Text style={[styles.paymentTenant, { color: colors.textPrimary }]}>{p.tenant_name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      {p.property_name} · Flat {p.flat_no}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      {getMonthName(p.month)} {p.year}
                      {p.paid_at ? ` · Paid ${new Date(p.paid_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
                    </Text>
                  </View>
                  <View style={styles.paymentRight}>
                    <Text style={[styles.paymentAmount, { color: colors.textPrimary }]}>{formatCurrency(p.amount_paid)}</Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>of {formatCurrency(p.amount_due)}</Text>
                    <PaymentStatusBadge status={p.status} />
                  </View>
                </View>
              </TouchableOpacity>
            </AnimatedCard>
          ))
        )}
      </ScrollView>

      {/* Sort Modal */}
      <Modal visible={sortModalVisible} transparent animationType="fade" onRequestClose={() => setSortModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSortModalVisible(false)}>
          <View style={[styles.sortSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sortSheetTitle, { color: colors.textPrimary }]}>Sort By</Text>
            {SORT_OPTIONS.map((opt) => {
              const active = sortKey === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sortOption, active && { backgroundColor: colors.primarySoft }]}
                  onPress={() => { setSortKey(opt.key); setSortModalVisible(false); }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name={opt.icon as any} size={18} color={active ? colors.primary : colors.textSecondary} />
                  <Text style={[{ fontSize: 14, fontWeight: '500', color: colors.textPrimary }, active && { color: colors.primary, fontWeight: '700' }]}>
                    {opt.label}
                  </Text>
                  {active && <MaterialCommunityIcons name="check" size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={[styles.sortCancel, { borderTopColor: colors.border }]} onPress={() => setSortModalVisible(false)}>
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Period Picker Modal */}
      <Modal visible={periodPickerVisible} transparent animationType="fade" onRequestClose={() => setPeriodPickerVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPeriodPickerVisible(false)}>
          <View style={[styles.periodSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.periodYearRow}>
              <TouchableOpacity onPress={() => setFilterYear((y) => y - 1)} hitSlop={8}>
                <MaterialCommunityIcons name="chevron-left" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.periodYearText, { color: colors.textPrimary }]}>{filterYear}</Text>
              <TouchableOpacity onPress={() => setFilterYear((y) => Math.min(currentYear, y + 1))} disabled={filterYear >= currentYear} hitSlop={8}>
                <MaterialCommunityIcons name="chevron-right" size={24} color={filterYear >= currentYear ? colors.textDisabled : colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.periodMonthGrid}>
              <TouchableOpacity
                style={[styles.periodMonthChip, { borderColor: colors.border, backgroundColor: colors.background }, filterMonth === null && { borderColor: colors.primary, backgroundColor: colors.primary + '14' }]}
                onPress={() => { setFilterMonth(null); setPeriodPickerVisible(false); }}
                activeOpacity={0.7}
              >
                <Text style={[{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }, filterMonth === null && { color: colors.primary, fontWeight: '700' }]}>All</Text>
              </TouchableOpacity>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                const active = filterMonth === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.periodMonthChip, { borderColor: colors.border, backgroundColor: colors.background }, active && { borderColor: colors.primary, backgroundColor: colors.primary + '14' }]}
                    onPress={() => { setFilterMonth(m); setPeriodPickerVisible(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }, active && { color: colors.primary, fontWeight: '700' }]}>
                      {MONTH_SHORT[m - 1]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={[styles.periodCancel, { borderTopColor: colors.border }]} onPress={() => setPeriodPickerVisible(false)}>
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  filterSection: { gap: 10, marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { fontSize: 18, fontWeight: '800' },
  periodBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  periodBtnText: { fontSize: 13, fontWeight: '700' },
  filterRow: { flexDirection: 'row' },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  summaryCard: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center', borderTopWidth: 3, borderWidth: 1 },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  summaryLabel: { fontSize: 10, marginTop: 2 },

  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  resultsCount: { fontSize: 13, fontWeight: '600' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  sortBtnText: { fontSize: 12, fontWeight: '600' },

  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: 'center', gap: 8 },

  paymentRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, marginBottom: 8, overflow: 'hidden', borderWidth: 1 },
  paymentAccent: { width: 3, alignSelf: 'stretch' },
  paymentRowInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingLeft: 14 },
  paymentInfo: { flex: 1, gap: 2, marginRight: 8 },
  paymentTenant: { fontSize: 14, fontWeight: '700' },
  paymentRight: { alignItems: 'flex-end', gap: 3 },
  paymentAmount: { fontSize: 14, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sortSheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 36, gap: 4 },
  sortSheetTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  sortOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10 },
  sortCancel: { paddingVertical: 14, marginTop: 8, borderTopWidth: 1, alignItems: 'center' },

  periodSheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 36 },
  periodYearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 },
  periodYearText: { fontSize: 18, fontWeight: '800', minWidth: 60, textAlign: 'center' },
  periodMonthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  periodMonthChip: { width: 70, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  periodCancel: { paddingVertical: 14, marginTop: 12, borderTopWidth: 1, alignItems: 'center' },
});
