import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Modal, TouchableOpacity, Alert } from 'react-native';
import { Text, ActivityIndicator, FAB } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useProperties } from '@/hooks/useProperties';
import { Payment, Tenant, Property } from '@/lib/types';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { Colors } from '@/constants/colors';
import { formatCurrency, getMonthName, getCurrentMonthYear } from '@/lib/utils';
import { shareAnnualSummary } from '@/lib/pdf';

interface PaymentWithContext extends Payment {
  tenant_name: string;
  flat_no: string;
  property_name: string;
  property_id: string;
  tenantId: string;
}

export default function PaymentsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { ownedProperties, tenantProperties } = useProperties();
  const [payments, setPayments] = useState<PaymentWithContext[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { month, year } = getCurrentMonthYear();

  // Year picker state
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const fetch = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    const results: PaymentWithContext[] = [];

    // Landlord: fetch current-month payments across all owned properties
    if (ownedProperties.length > 0) {
      const propertyIds = ownedProperties.map((p) => p.id);
      const { data } = await supabase
        .from('payments')
        .select('*, tenants(tenant_name, flat_no, property_id)')
        .in('property_id', propertyIds)
        .eq('month', month)
        .eq('year', year)
        .order('status');

      (data ?? []).forEach((p: any) => {
        const property = ownedProperties.find((prop) => prop.id === p.property_id);
        results.push({
          ...p,
          tenant_name: p.tenants?.tenant_name ?? 'Unknown',
          flat_no: p.tenants?.flat_no ?? '—',
          property_name: property?.name ?? '—',
          tenantId: p.tenant_id,
        });
      });
    }

    // Tenant: fetch own payments
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
          property_name: tp.properties?.name ?? '—',
          tenantId: tp.id,
        });
      });
    }

    setPayments(results);
    setIsLoading(false);
  }, [user, ownedProperties.length, tenantProperties.length, month, year]);

  useEffect(() => { fetch(); }, [fetch]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (payments.length === 0) {
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

  // Group by property for landlord view
  const landlordPayments = payments.filter((p) =>
    ownedProperties.some((prop) => prop.id === p.property_id)
  );
  const tenantPayments = payments.filter((p) =>
    !ownedProperties.some((prop) => prop.id === p.property_id)
  );

  const totalDue = landlordPayments.reduce((s, p) => s + p.amount_due, 0);
  const totalCollected = landlordPayments.reduce((s, p) => s + p.amount_paid, 0);

  // Available years from tenant payments
  const availableYears = [...new Set(tenantPayments.map((p) => p.year))].sort((a, b) => b - a);

  async function handleExportYear(selectedYear: number) {
    setYearPickerVisible(false);
    if (tenantPayments.length === 0) return;

    const firstTenantPayment = tenantPayments[0];
    const tp = tenantProperties.find((t) => t.id === firstTenantPayment.tenantId);
    if (!tp) return;

    const property = tp.properties;
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

  const isLandlord = ownedProperties.length > 0;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetch} />}
      >
        {/* Landlord Overview */}
        {landlordPayments.length > 0 && (
          <>
            <Text variant="titleMedium" style={styles.sectionHeader}>
              {getMonthName(month)} {year} — My Properties
            </Text>

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text variant="headlineSmall" style={styles.summaryValue}>{formatCurrency(totalCollected)}</Text>
                <Text variant="bodySmall" style={styles.summaryLabel}>Collected</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text variant="headlineSmall" style={styles.summaryValue}>{formatCurrency(totalDue - totalCollected)}</Text>
                <Text variant="bodySmall" style={styles.summaryLabel}>Outstanding</Text>
              </View>
            </View>

            {landlordPayments.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.paymentRow}
                onPress={() => router.push(`/property/${p.property_id}/tenant/${p.tenantId}/payment/${p.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.paymentInfo}>
                  <Text variant="titleSmall" style={styles.tenantName}>{p.tenant_name}</Text>
                  <Text variant="bodySmall" style={styles.propertyMeta}>
                    Flat {p.flat_no} · {p.property_name}
                  </Text>
                  <Text variant="bodySmall" style={styles.rent}>{formatCurrency(p.amount_due)}</Text>
                </View>
                <PaymentStatusBadge status={p.status} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Tenant Payment History */}
        {tenantPayments.length > 0 && (
          <>
            <View style={[styles.sectionRow, landlordPayments.length > 0 && styles.sectionHeaderSpaced]}>
              <Text variant="titleMedium" style={styles.sectionHeader}>My Rent History</Text>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={() => setYearPickerVisible(true)}
                disabled={exportingPdf}
                activeOpacity={0.7}
              >
                {exportingPdf ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Text variant="labelMedium" style={styles.exportLabel}>Export PDF</Text>
                )}
              </TouchableOpacity>
            </View>
            {tenantPayments.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.paymentRow}
                onPress={() => router.push(`/property/${p.property_id}/tenant/${p.tenantId}/payment/${p.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.paymentInfo}>
                  <Text variant="titleSmall" style={styles.tenantName}>
                    {getMonthName(p.month)} {p.year}
                  </Text>
                  <Text variant="bodySmall" style={styles.propertyMeta}>{p.property_name} · Flat {p.flat_no}</Text>
                  <Text variant="bodySmall" style={styles.rent}>{formatCurrency(p.amount_due)}</Text>
                </View>
                <PaymentStatusBadge status={p.status} />
              </TouchableOpacity>
            ))}
          </>
        )}
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
            <Text variant="titleMedium" style={styles.yearPickerTitle}>Select Year to Export</Text>
            {availableYears.map((y) => (
              <TouchableOpacity
                key={y}
                style={styles.yearOption}
                onPress={() => handleExportYear(y)}
                activeOpacity={0.7}
              >
                <Text variant="bodyLarge" style={styles.yearOptionText}>{y}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelOption} onPress={() => setYearPickerVisible(false)}>
              <Text variant="bodyMedium" style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: Colors.primary,
  },
  content: { padding: 16, gap: 8, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionHeader: {
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeaderSpaced: { marginTop: 20 },
  exportButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    minWidth: 80,
    alignItems: 'center',
  },
  exportLabel: { color: Colors.primary },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryValue: { color: Colors.primary, fontWeight: '700' },
  summaryLabel: { color: Colors.textSecondary, marginTop: 2 },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  paymentInfo: { flex: 1, gap: 2 },
  tenantName: { color: Colors.textPrimary, fontWeight: '600' },
  propertyMeta: { color: Colors.textSecondary },
  rent: { color: Colors.textSecondary, fontWeight: '500' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  yearPickerSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
    gap: 4,
  },
  yearPickerTitle: {
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  yearOption: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  yearOptionText: { color: Colors.primary, fontWeight: '600' },
  cancelOption: {
    paddingVertical: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: { color: Colors.textSecondary },
});
