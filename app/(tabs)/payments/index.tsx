import { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Modal, TouchableOpacity, Alert } from 'react-native';
import { Text, ActivityIndicator, FAB } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useProperties } from '@/hooks/useProperties';
import { Payment } from '@/lib/types';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { Colors } from '@/constants/colors';
import { formatCurrency, getMonthName, getCurrentMonthYear } from '@/lib/utils';
import { shareAnnualSummary } from '@/lib/pdf';
import { getStatusColor } from '@/lib/payments';

interface TenantOption {
  id: string;
  tenant_name: string;
  flat_no: string;
  property_id: string;
  monthly_rent: number;
}

interface PaymentWithContext extends Payment {
  tenant_name: string;
  flat_no: string;
  property_name: string;
  tenantId: string;
}

export default function PaymentsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { ownedProperties, tenantProperties } = useProperties();
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
  const loadedRef = useRef(false);

  // Landlord state
  const [allTenants, setAllTenants] = useState<TenantOption[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [landlordPayments, setLandlordPayments] = useState<Payment[]>([]);
  const [loadingLandlord, setLoadingLandlord] = useState(false);

  // Tenant (as renter) state
  const [tenantPayments, setTenantPayments] = useState<PaymentWithContext[]>([]);
  const [loadingTenant, setLoadingTenant] = useState(false);

  // PDF export
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const isLandlord = ownedProperties.length > 0;

  // Load tenant list for landlord selectors (once)
  useEffect(() => {
    if (!isLandlord || loadedRef.current) return;
    loadedRef.current = true;
    loadTenants();
  }, [isLandlord]);

  async function loadTenants() {
    const { data } = await supabase
      .from('tenants')
      .select('id, tenant_name, flat_no, property_id, monthly_rent')
      .in('property_id', ownedProperties.map((p) => p.id))
      .eq('is_archived', false)
      .order('tenant_name');

    const tenants: TenantOption[] = data ?? [];
    setAllTenants(tenants);

    // Auto-select first property and first tenant
    if (ownedProperties.length > 0) {
      const firstProp = ownedProperties[0].id;
      setSelectedPropertyId(firstProp);
      const first = tenants.find((t) => t.property_id === firstProp);
      if (first) setSelectedTenantId(first.id);
    }
  }

  // Fetch all payments for selected tenant
  useEffect(() => {
    if (!selectedTenantId) return;
    fetchLandlordPayments(selectedTenantId);
  }, [selectedTenantId]);

  async function fetchLandlordPayments(tenantId: string) {
    setLoadingLandlord(true);
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    setLandlordPayments((data as Payment[]) ?? []);
    setLoadingLandlord(false);
  }

  // Fetch tenant (renter) payments
  const fetchTenantPayments = useCallback(async () => {
    if (tenantProperties.length === 0) return;
    setLoadingTenant(true);
    const results: PaymentWithContext[] = [];
    for (const tp of tenantProperties) {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', tp.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      (data ?? []).forEach((p: any) => {
        results.push({
          ...p,
          tenant_name: tp.tenant_name,
          flat_no: tp.flat_no,
          property_name: (tp as any).properties?.name ?? '—',
          tenantId: tp.id,
        });
      });
    }
    setTenantPayments(results);
    setLoadingTenant(false);
  }, [tenantProperties.length]);

  useEffect(() => { fetchTenantPayments(); }, [fetchTenantPayments]);

  const tenantsForProperty = allTenants.filter((t) => t.property_id === selectedPropertyId);

  function selectProperty(propId: string) {
    setSelectedPropertyId(propId);
    const first = allTenants.find((t) => t.property_id === propId);
    setSelectedTenantId(first?.id ?? null);
  }

  function selectTenant(tenantId: string) {
    setSelectedTenantId(tenantId);
  }

  // Current-month summary for selected tenant
  const currentMonthPayment = landlordPayments.find(
    (p) => p.month === currentMonth && p.year === currentYear
  );

  // Tenant PDF export
  const availableYears = [...new Set(tenantPayments.map((p) => p.year))].sort((a, b) => b - a);

  async function handleExportYear(selectedYear: number) {
    setYearPickerVisible(false);
    if (tenantPayments.length === 0) return;
    const tp = tenantProperties[0];
    if (!tp) return;
    const property = (tp as any).properties;
    if (!property) return;
    const yearPayments = tenantPayments
      .filter((p) => p.year === selectedYear && p.tenantId === tp.id)
      .map((p) => p as Payment);
    if (yearPayments.length === 0) {
      Alert.alert('No Data', `No payments found for ${selectedYear}.`);
      return;
    }
    setExportingPdf(true);
    try {
      await shareAnnualSummary(yearPayments, tp, property, selectedYear);
    } catch (err) {
      Alert.alert('Export Failed', String(err));
    } finally {
      setExportingPdf(false);
    }
  }

  const isLoading = loadingLandlord || loadingTenant;

  if (!isLandlord && tenantPayments.length === 0 && !isLoading) {
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

  const selectedProperty = ownedProperties.find((p) => p.id === selectedPropertyId);
  const selectedTenant = allTenants.find((t) => t.id === selectedTenantId);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              if (selectedTenantId) fetchLandlordPayments(selectedTenantId);
              fetchTenantPayments();
            }}
          />
        }
      >
        {/* ── Landlord section ── */}
        {isLandlord && (
          <>
            {/* Property selector */}
            <Text style={styles.fieldLabel}>Property</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
              {ownedProperties.map((p, i) => {
                const active = p.id === selectedPropertyId;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.chip, active && styles.chipActive, i < ownedProperties.length - 1 && { marginRight: 8 }]}
                    onPress={() => selectProperty(p.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Tenant selector */}
            {tenantsForProperty.length > 0 ? (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Tenant</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
                  {tenantsForProperty.map((t, i) => {
                    const active = t.id === selectedTenantId;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.chip, active && styles.chipActive, i < tenantsForProperty.length - 1 && { marginRight: 8 }]}
                        onPress={() => selectTenant(t.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.tenant_name}</Text>
                        <Text style={[styles.chipSub, active && { color: Colors.primary }]}>{' · '}{t.flat_no}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            ) : selectedPropertyId ? (
              <Text style={styles.hint}>No tenants in this property.</Text>
            ) : null}

            {/* Current month summary */}
            {currentMonthPayment && (
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{formatCurrency(currentMonthPayment.amount_paid)}</Text>
                  <Text style={styles.summaryLabel}>Collected this month</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={[styles.summaryValue, { color: Colors.statusOverdue }]}>
                    {formatCurrency(currentMonthPayment.amount_due - currentMonthPayment.amount_paid)}
                  </Text>
                  <Text style={styles.summaryLabel}>Outstanding</Text>
                </View>
              </View>
            )}

            {/* All payments for selected tenant */}
            {loadingLandlord ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
            ) : landlordPayments.length === 0 && selectedTenantId ? (
              <Text style={styles.hint}>No payment records yet for this tenant.</Text>
            ) : (
              landlordPayments.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.paymentRow}
                  onPress={() =>
                    router.push(`/property/${p.property_id}/tenant/${p.tenant_id}/payment/${p.id}`)
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentMonth}>
                      {getMonthName(p.month)} {p.year}
                    </Text>
                    {selectedTenant && (
                      <Text style={styles.paymentMeta}>
                        {selectedTenant.tenant_name} · Flat {selectedTenant.flat_no}
                      </Text>
                    )}
                    <Text style={styles.paymentMeta}>
                      Due {formatCurrency(p.amount_due)}
                      {p.amount_paid > 0 && ` · Paid ${formatCurrency(p.amount_paid)}`}
                    </Text>
                  </View>
                  <PaymentStatusBadge status={p.status} />
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* ── Tenant (renter) section ── */}
        {tenantPayments.length > 0 && (
          <>
            <View style={[styles.sectionRow, isLandlord && { marginTop: 28 }]}>
              <Text style={styles.fieldLabel}>My Rent History</Text>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={() => setYearPickerVisible(true)}
                disabled={exportingPdf}
                activeOpacity={0.7}
              >
                {exportingPdf ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Text style={styles.exportLabel}>Export PDF</Text>
                )}
              </TouchableOpacity>
            </View>
            {tenantPayments.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.paymentRow}
                onPress={() =>
                  router.push(`/property/${p.property_id}/tenant/${p.tenantId}/payment/${p.id}`)
                }
                activeOpacity={0.7}
              >
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentMonth}>
                    {getMonthName(p.month)} {p.year}
                  </Text>
                  <Text style={styles.paymentMeta}>
                    {p.property_name} · Flat {p.flat_no}
                  </Text>
                  <Text style={styles.paymentMeta}>{formatCurrency(p.amount_due)}</Text>
                </View>
                <PaymentStatusBadge status={p.status} />
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Log Payment FAB — landlords only */}
      {isLandlord && (
        <FAB
          icon="plus"
          label="Log Payment"
          style={styles.fab}
          color="#fff"
          onPress={() => router.push('/log-payment')}
        />
      )}

      {/* Year Picker Modal */}
      <Modal
        visible={yearPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setYearPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setYearPickerVisible(false)}
        >
          <View style={styles.yearPickerSheet}>
            <Text style={styles.yearPickerTitle}>Select Year to Export</Text>
            {availableYears.map((y) => (
              <TouchableOpacity
                key={y}
                style={styles.yearOption}
                onPress={() => handleExportYear(y)}
                activeOpacity={0.7}
              >
                <Text style={styles.yearOptionText}>{y}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelOption} onPress={() => setYearPickerVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
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
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  hint: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, marginBottom: 8 },
  selectorRow: { flexDirection: 'row', marginBottom: 4 },
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
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '12' },
  chipText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary, fontWeight: '700' },
  chipSub: { fontSize: 12, color: Colors.textSecondary },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 14 },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryValue: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  summaryLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  paymentInfo: { flex: 1, gap: 3, marginRight: 8 },
  paymentMonth: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  paymentMeta: { fontSize: 12, color: Colors.textSecondary },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exportButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    minWidth: 80,
    alignItems: 'center',
  },
  exportLabel: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: Colors.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  yearPickerSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
    gap: 4,
  },
  yearPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  yearOption: { paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  yearOptionText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  cancelOption: {
    paddingVertical: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: { fontSize: 14, color: Colors.textSecondary },
});
