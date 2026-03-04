import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, ActivityIndicator, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useProperties } from '@/hooks/useProperties';
import { Payment, Tenant, Property } from '@/lib/types';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { Colors } from '@/constants/colors';
import { formatCurrency, getMonthName, getCurrentMonthYear } from '@/lib/utils';
import { TouchableOpacity } from 'react-native';

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
        .order('month', { ascending: false })
        .limit(12);

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

  return (
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
          <Text variant="titleMedium" style={[styles.sectionHeader, landlordPayments.length > 0 && styles.sectionHeaderSpaced]}>
            My Rent History
          </Text>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 8, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  sectionHeader: {
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionHeaderSpaced: { marginTop: 20 },
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
});
