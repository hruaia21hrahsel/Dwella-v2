import { useState, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Modal, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useProperties } from '@/hooks/useProperties';
import { Payment, PaymentStatus } from '@/lib/types';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Shadows } from '@/constants/colors';
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
  const { user } = useAuthStore();
  const { ownedProperties } = useProperties();
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
  const loadedRef = useRef(false);

  // Data
  const [allTenants, setAllTenants] = useState<TenantOption[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterPropertyId, setFilterPropertyId] = useState<string | null>(null); // null = All
  const [filterTenantId, setFilterTenantId] = useState<string | null>(null); // null = All
  const [filterMonth, setFilterMonth] = useState<number | null>(currentMonth); // null = All
  const [filterYear, setFilterYear] = useState<number>(currentYear);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('date_desc');
  const [sortModalVisible, setSortModalVisible] = useState(false);

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
    if (!user?.id || !isLandlord || loadedRef.current) return;
    loadedRef.current = true;
    loadData();
  }, [user?.id, isLandlord]);

  async function loadData() {
    setLoading(true);

    // Load tenants
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id, tenant_name, flat_no, property_id, monthly_rent')
      .in('property_id', ownedProperties.map((p) => p.id))
      .eq('is_archived', false)
      .order('tenant_name');

    const tenants: TenantOption[] = tenantData ?? [];
    setAllTenants(tenants);

    // Load all payments across all owned properties with tenant info
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

  if (loading) {
    return <ListSkeleton count={5} />;
  }

  if (!isLandlord) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="receipt"
          title="No payments yet"
          subtitle="Add properties and tenants to start tracking payments."
        />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={handleRefresh} />}
      >
        {/* ── Filters ── */}
        <View style={styles.filterSection}>
          {/* Year selector */}
          <View style={styles.yearRow}>
            <Text style={styles.pageTitle}>Payment History</Text>
            <View style={styles.yearPicker}>
              <TouchableOpacity onPress={() => setFilterYear((y) => y - 1)} hitSlop={8}>
                <MaterialCommunityIcons name="chevron-left" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.yearText}>{filterYear}</Text>
              <TouchableOpacity
                onPress={() => setFilterYear((y) => Math.min(currentYear, y + 1))}
                disabled={filterYear >= currentYear}
                hitSlop={8}
              >
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={filterYear >= currentYear ? Colors.textDisabled : Colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Month filter */}
          <View style={styles.monthRow}>
            <TouchableOpacity
              style={[styles.monthChip, filterMonth === null && styles.monthChipActive]}
              onPress={() => selectMonth(null)}
              activeOpacity={0.7}
            >
              <Text style={[styles.monthChipText, filterMonth === null && styles.monthChipTextActive]}>All</Text>
            </TouchableOpacity>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.monthChip, filterMonth === m && styles.monthChipActive]}
                onPress={() => selectMonth(m)}
                activeOpacity={0.7}
              >
                <Text style={[styles.monthChipText, filterMonth === m && styles.monthChipTextActive]}>
                  {MONTH_SHORT[m - 1]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Property filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.chip, !filterPropertyId && styles.chipActive]}
              onPress={() => selectProperty(null)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, !filterPropertyId && styles.chipTextActive]}>All Properties</Text>
            </TouchableOpacity>
            {properties.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.chip, filterPropertyId === p.id && styles.chipActive, { marginLeft: 8 }]}
                onPress={() => selectProperty(p.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, filterPropertyId === p.id && styles.chipTextActive]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Tenant filter — only shown when a specific property is selected */}
          {filterPropertyId && tenantsForFilter.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.chip, !filterTenantId && styles.chipActive]}
                onPress={() => setFilterTenantId(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, !filterTenantId && styles.chipTextActive]}>All Tenants</Text>
              </TouchableOpacity>
              {tenantsForFilter.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.chip, filterTenantId === t.id && styles.chipActive, { marginLeft: 8 }]}
                  onPress={() => setFilterTenantId(t.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, filterTenantId === t.id && styles.chipTextActive]}>
                    {t.tenant_name}
                  </Text>
                  <Text style={[styles.chipSub, filterTenantId === t.id && { color: Colors.primary }]}>
                    {' · '}{t.flat_no}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Summary cards ── */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderTopColor: Colors.primary }]}>
            <Text style={styles.summaryValue}>{formatCurrency(summaryStats.total)}</Text>
            <Text style={styles.summaryLabel}>Total Due</Text>
          </View>
          <View style={[styles.summaryCard, { borderTopColor: Colors.statusConfirmed }]}>
            <Text style={[styles.summaryValue, { color: Colors.statusConfirmed }]}>
              {formatCurrency(summaryStats.collected)}
            </Text>
            <Text style={styles.summaryLabel}>Collected</Text>
          </View>
          <View style={[styles.summaryCard, { borderTopColor: Colors.statusOverdue }]}>
            <Text style={[styles.summaryValue, { color: Colors.statusOverdue }]}>
              {formatCurrency(summaryStats.outstanding)}
            </Text>
            <Text style={styles.summaryLabel}>Outstanding</Text>
          </View>
        </View>

        {/* ── Results header with sort ── */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {summaryStats.count} payment{summaryStats.count !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={() => setSortModalVisible(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="sort-variant" size={16} color={Colors.primary} />
            <Text style={styles.sortBtnText}>Sort</Text>
          </TouchableOpacity>
        </View>

        {/* ── Payment list ── */}
        {sortedPayments.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="cash-remove" size={28} color={Colors.textDisabled} />
            <Text style={styles.emptyText}>No payments found for this filter</Text>
          </View>
        ) : (
          sortedPayments.map((p, index) => (
            <AnimatedCard key={p.id} index={index}>
              <TouchableOpacity
                style={styles.paymentRow}
                onPress={() =>
                  router.push(`/property/${p.property_id}/tenant/${p.tenant_id}/payment/${p.id}`)
                }
                activeOpacity={0.7}
              >
                <View style={[styles.paymentAccent, { backgroundColor: getStatusColor(p.status) }]} />
                <View style={styles.paymentRowInner}>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentTenant}>{p.tenant_name}</Text>
                    <Text style={styles.paymentMeta}>
                      {p.property_name} · Flat {p.flat_no}
                    </Text>
                    <Text style={styles.paymentMeta}>
                      {getMonthName(p.month)} {p.year}
                      {p.paid_at ? ` · Paid ${new Date(p.paid_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
                    </Text>
                  </View>
                  <View style={styles.paymentRight}>
                    <Text style={styles.paymentAmount}>{formatCurrency(p.amount_paid)}</Text>
                    <Text style={styles.paymentDue}>of {formatCurrency(p.amount_due)}</Text>
                    <PaymentStatusBadge status={p.status} />
                  </View>
                </View>
              </TouchableOpacity>
            </AnimatedCard>
          ))
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Log Payment FAB */}
      <FAB
        icon="plus"
        label="Log Payment"
        style={styles.fab}
        color="#fff"
        onPress={() => router.push('/log-payment')}
      />

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
          <View style={styles.sortSheet}>
            <Text style={styles.sortSheetTitle}>Sort By</Text>
            {SORT_OPTIONS.map((opt) => {
              const active = sortKey === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sortOption, active && styles.sortOptionActive]}
                  onPress={() => {
                    setSortKey(opt.key);
                    setSortModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={opt.icon as any}
                    size={18}
                    color={active ? Colors.primary : Colors.textSecondary}
                  />
                  <Text style={[styles.sortOptionText, active && styles.sortOptionTextActive]}>
                    {opt.label}
                  </Text>
                  {active && (
                    <MaterialCommunityIcons name="check" size={18} color={Colors.primary} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.sortCancel}
              onPress={() => setSortModalVisible(false)}
            >
              <Text style={styles.sortCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },

  // Filters
  filterSection: {
    gap: 10,
    marginBottom: 14,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  yearPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  yearText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginHorizontal: 6,
  },
  monthRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  monthChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  monthChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '14',
  },
  monthChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  monthChipTextActive: {
    color: Colors.primary,
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
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  chipText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary, fontWeight: '700' },
  chipSub: { fontSize: 12, color: Colors.textSecondary },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryValue: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  summaryLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },

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
    color: Colors.textSecondary,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Empty
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // Payment rows
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
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
  paymentTenant: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  paymentMeta: { fontSize: 12, color: Colors.textSecondary },
  paymentRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  paymentAmount: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  paymentDue: { fontSize: 11, color: Colors.textSecondary },

  // FAB
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: Colors.primary,
    borderRadius: 16,
  },

  // Sort modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sortSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
    gap: 4,
  },
  sortSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
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
  sortOptionActive: {
    backgroundColor: Colors.primarySoft,
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  sortOptionTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  sortCancel: {
    paddingVertical: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  sortCancelText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
