import { useState, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Modal, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useProperties } from '@/hooks/useProperties';
import { Payment, PaymentStatus } from '@/lib/types';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, getMonthName, getCurrentMonthYear } from '@/lib/utils';
import { getStatusColor } from '@/lib/payments';
import { useToastStore } from '@/lib/toast';
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
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const { ownedProperties, isLoading: propertiesLoading } = useProperties();
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
  const loadedRef = useRef(false);

  // Data
  const [allTenants, setAllTenants] = useState<TenantOption[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterPropertyId, setFilterPropertyId] = useState<string | null>(null); // null = All
  const [filterTenantId, setFilterTenantId] = useState<string | null>(null); // null = All
  const [filterMonth, setFilterMonth] = useState<number | null>(currentMonth); // null = All
  const [filterYear, setFilterYear] = useState<number>(currentYear);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('date_desc');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  // Period picker
  const [periodPickerVisible, setPeriodPickerVisible] = useState(false);

  const isLandlord = ownedProperties.length > 0;

  // Build property list
  const properties: PropertyOption[] = useMemo(
    () => ownedProperties.map((p) => ({ id: p.id, name: p.name })),
    [ownedProperties],
  );

  // Tenants for the selected property filter
  const tenantsForFilter = useMemo(
    () => (filterPropertyId ? allTenants.filter((t) => t.property_id === filterPropertyId) : allTenants),
    [allTenants, filterPropertyId],
  );

  // ── Data loading ──

  useEffect(() => {
    // Wait for properties to finish loading before deciding what to do.
    if (!user?.id || propertiesLoading) return;
    if (!isLandlord) return; // no properties → nothing to fetch, stay loading=false
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadData();
  }, [user?.id, isLandlord, propertiesLoading]);

  async function loadData() {
    setLoading(true);
    try {
      // Load tenants
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('id, tenant_name, flat_no, property_id, monthly_rent')
        .in('property_id', ownedProperties.map((p) => p.id))
        .eq('is_archived', false)
        .order('tenant_name');

      if (tenantError) throw tenantError;
      setAllTenants(tenantData ?? []);

      // Load all payments across all owned properties with tenant info
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('*, tenants!inner(tenant_name, flat_no, property_id, properties!inner(name))')
        .in('property_id', ownedProperties.map((p) => p.id))
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (paymentError) throw paymentError;

      const payments: PaymentRow[] = (paymentData ?? []).map((p: any) => ({
        ...p,
        tenant_name: p.tenants?.tenant_name ?? '—',
        flat_no: p.tenants?.flat_no ?? '—',
        property_name: p.tenants?.properties?.name ?? '—',
        tenants: undefined,
      }));

      setAllPayments(payments);
    } catch (err: any) {
      useToastStore.getState().showToast(err.message ?? 'Failed to load payments.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    loadedRef.current = false;
    await loadData();
  }

  // ── Filtering ──

  const filteredPayments = useMemo(() => {
    let result = allPayments;

    if (filterPropertyId) {
      result = result.filter((p) => p.property_id === filterPropertyId);
    }
    if (filterTenantId) {
      result = result.filter((p) => p.tenant_id === filterTenantId);
    }
    if (filterMonth !== null) {
      result = result.filter((p) => p.month === filterMonth);
    }
    result = result.filter((p) => p.year === filterYear);

    return result;
  }, [allPayments, filterPropertyId, filterTenantId, filterMonth, filterYear]);

  // ── Sorting ──

  const sortedPayments = useMemo(() => {
    const arr = [...filteredPayments];
    switch (sortKey) {
      case 'date_desc':
        return arr.sort((a, b) => b.year - a.year || b.month - a.month);
      case 'date_asc':
        return arr.sort((a, b) => a.year - b.year || a.month - b.month);
      case 'amount_desc':
        return arr.sort((a, b) => b.amount_paid - a.amount_paid);
      case 'amount_asc':
        return arr.sort((a, b) => a.amount_paid - b.amount_paid);
      case 'status':
        return arr.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
      default:
        return arr;
    }
  }, [filteredPayments, sortKey]);

  // ── Summary stats ──

  const summaryStats = useMemo(() => {
    const total = filteredPayments.reduce((s, p) => s + p.amount_due, 0);
    const collected = filteredPayments.reduce((s, p) => s + p.amount_paid, 0);
    const overdue = filteredPayments.filter((p) => p.status === 'overdue').length;
    return { total, collected, outstanding: total - collected, overdue, count: filteredPayments.length };
  }, [filteredPayments]);

  // ── Filter handlers ──

  function selectProperty(propId: string | null) {
    setFilterPropertyId(propId);
    setFilterTenantId(null); // reset tenant when property changes
  }

  function selectMonth(m: number | null) {
    setFilterMonth(m);
  }

  // ── Render ──

  const topBar = (
    <LinearGradient
      colors={[colors.surface, colors.primarySoft]}
      start={{ x: 0.35, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.topBar, { paddingTop: insets.top, shadowColor: colors.primary }]}
    >
      <TouchableOpacity
        style={styles.topBarBtn}
        onPress={() => router.back()}
        activeOpacity={0.7}
        accessibilityLabel="Go back"
      >
        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text style={[styles.topBarTitle, { color: colors.textPrimary }]}>Payment History</Text>
      <View style={styles.topBarBtn} />
    </LinearGradient>
  );

  if (propertiesLoading || loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {topBar}
        <ListSkeleton count={5} />
      </View>
    );
  }

  if (!isLandlord) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {topBar}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="receipt"
            title="No payments yet"
            subtitle="Add properties and tenants to start tracking payments."
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {topBar}
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={propertiesLoading || loading} onRefresh={handleRefresh} />}
      >
        {/* ── Filters ── */}
        <View style={styles.filterSection}>
          {/* Period dropdown */}
          <View style={styles.titleRow}>
            <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Filters</Text>
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
              <Text style={[styles.chipText, { color: colors.textSecondary }, !filterPropertyId && { color: colors.primary, fontWeight: '700' }]}>All Properties</Text>
            </TouchableOpacity>
            {properties.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface, marginLeft: 8 }, filterPropertyId === p.id && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
                onPress={() => selectProperty(p.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, { color: colors.textSecondary }, filterPropertyId === p.id && { color: colors.primary, fontWeight: '700' }]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Tenant filter — only shown when a specific property is selected */}
          {filterPropertyId && tenantsForFilter.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }, !filterTenantId && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
                onPress={() => setFilterTenantId(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, { color: colors.textSecondary }, !filterTenantId && { color: colors.primary, fontWeight: '700' }]}>All Tenants</Text>
              </TouchableOpacity>
              {tenantsForFilter.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface, marginLeft: 8 }, filterTenantId === t.id && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
                  onPress={() => setFilterTenantId(t.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, { color: colors.textSecondary }, filterTenantId === t.id && { color: colors.primary, fontWeight: '700' }]}>
                    {t.tenant_name}
                  </Text>
                  <Text style={[styles.chipSub, { color: colors.textSecondary }, filterTenantId === t.id && { color: colors.primary }]}>
                    {' · '}{t.flat_no}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Summary cards ── */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border, borderTopColor: colors.primary }]}>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>{formatCurrency(summaryStats.total)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Due</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border, borderTopColor: colors.statusConfirmed }]}>
            <Text style={[styles.summaryValue, { color: colors.statusConfirmed }]}>
              {formatCurrency(summaryStats.collected)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Collected</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border, borderTopColor: colors.statusOverdue }]}>
            <Text style={[styles.summaryValue, { color: colors.statusOverdue }]}>
              {formatCurrency(summaryStats.outstanding)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Outstanding</Text>
          </View>
        </View>

        {/* ── Results header with sort ── */}
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

        {/* ── Payment list ── */}
        {sortedPayments.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="cash-remove" size={28} color={colors.textDisabled} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No payments found for this filter</Text>
          </View>
        ) : (
          sortedPayments.map((p, index) => (
            <AnimatedCard key={p.id} index={index}>
              <TouchableOpacity
                style={[styles.paymentRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() =>
                  router.push(`/property/${p.property_id}/tenant/${p.tenant_id}/payment/${p.id}`)
                }
                activeOpacity={0.7}
              >
                <View style={[styles.paymentAccent, { backgroundColor: getStatusColor(p.status) }]} />
                <View style={styles.paymentRowInner}>
                  <View style={styles.paymentInfo}>
                    <Text style={[styles.paymentTenant, { color: colors.textPrimary }]}>{p.tenant_name}</Text>
                    <Text style={[styles.paymentMeta, { color: colors.textSecondary }]}>
                      {p.property_name} · Flat {p.flat_no}
                    </Text>
                    <Text style={[styles.paymentMeta, { color: colors.textSecondary }]}>
                      {getMonthName(p.month)} {p.year}
                      {p.paid_at ? ` · Paid ${new Date(p.paid_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
                    </Text>
                  </View>
                  <View style={styles.paymentRight}>
                    <Text style={[styles.paymentAmount, { color: colors.textPrimary }]}>{formatCurrency(p.amount_paid)}</Text>
                    <Text style={[styles.paymentDue, { color: colors.textSecondary }]}>of {formatCurrency(p.amount_due)}</Text>
                    <PaymentStatusBadge status={p.status} />
                  </View>
                </View>
              </TouchableOpacity>
            </AnimatedCard>
          ))
        )}

      </ScrollView>

      {/* ── Sort Modal ── */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSortModalVisible(false)}
        >
          <View style={[styles.sortSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sortSheetTitle, { color: colors.textPrimary }]}>Sort By</Text>
            {SORT_OPTIONS.map((opt) => {
              const active = sortKey === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sortOption, active && { backgroundColor: colors.primarySoft }]}
                  onPress={() => {
                    setSortKey(opt.key);
                    setSortModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={opt.icon as any}
                    size={18}
                    color={active ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.sortOptionText, { color: colors.textPrimary }, active && { color: colors.primary, fontWeight: '700' }]}>
                    {opt.label}
                  </Text>
                  {active && (
                    <MaterialCommunityIcons name="check" size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.sortCancel, { borderTopColor: colors.border }]}
              onPress={() => setSortModalVisible(false)}
            >
              <Text style={[styles.sortCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      {/* ── Period Picker Modal ── */}
      <Modal
        visible={periodPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPeriodPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPeriodPickerVisible(false)}
        >
          <View style={[styles.periodSheet, { backgroundColor: colors.surface }]}>
            {/* Year selector */}
            <View style={styles.periodYearRow}>
              <TouchableOpacity onPress={() => setFilterYear((y) => y - 1)} hitSlop={8}>
                <MaterialCommunityIcons name="chevron-left" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.periodYearText, { color: colors.textPrimary }]}>{filterYear}</Text>
              <TouchableOpacity
                onPress={() => setFilterYear((y) => Math.min(currentYear, y + 1))}
                disabled={filterYear >= currentYear}
                hitSlop={8}
              >
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color={filterYear >= currentYear ? colors.textDisabled : colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Month grid */}
            <View style={styles.periodMonthGrid}>
              <TouchableOpacity
                style={[styles.periodMonthChip, { borderColor: colors.border, backgroundColor: colors.background }, filterMonth === null && { borderColor: colors.primary, backgroundColor: colors.primary + '14' }]}
                onPress={() => { setFilterMonth(null); setPeriodPickerVisible(false); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.periodMonthText, { color: colors.textSecondary }, filterMonth === null && { color: colors.primary, fontWeight: '700' }]}>
                  All
                </Text>
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
                    <Text style={[styles.periodMonthText, { color: colors.textSecondary }, active && { color: colors.primary, fontWeight: '700' }]}>
                      {MONTH_SHORT[m - 1]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.periodCancel, { borderTopColor: colors.border }]}
              onPress={() => setPeriodPickerVisible(false)}
            >
              <Text style={[styles.periodCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 3,
  },
  topBarBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
  },

  // Filters
  filterSection: {
    gap: 10,
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  periodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  periodBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  chipSub: { fontSize: 12 },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 3,
    borderWidth: 1,
  },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  summaryLabel: { fontSize: 10, marginTop: 2 },

  // Results header
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Empty
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
  },

  // Payment rows
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
  },
  paymentAccent: {
    width: 3,
    alignSelf: 'stretch',
  },
  paymentRowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingLeft: 14,
  },
  paymentInfo: { flex: 1, gap: 2, marginRight: 8 },
  paymentTenant: { fontSize: 14, fontWeight: '700' },
  paymentMeta: { fontSize: 12 },
  paymentRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  paymentAmount: { fontSize: 14, fontWeight: '700' },
  paymentDue: { fontSize: 11 },

  // Sort modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sortSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
    gap: 4,
  },
  sortSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sortCancel: {
    paddingVertical: 14,
    marginTop: 8,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  sortCancelText: {
    fontSize: 14,
  },

  // Period picker modal
  periodSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
  },
  periodYearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  periodYearText: {
    fontSize: 18,
    fontWeight: '800',
    minWidth: 60,
    textAlign: 'center',
  },
  periodMonthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  periodMonthChip: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodMonthText: {
    fontSize: 14,
    fontWeight: '600',
  },
  periodCancel: {
    paddingVertical: 14,
    marginTop: 12,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  periodCancelText: {
    fontSize: 14,
  },
});
