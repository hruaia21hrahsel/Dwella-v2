import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, HelperText, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Colors } from '@/constants/colors';
import { getDueDate, getProofStoragePath } from '@/lib/payments';
import { ProofUploader } from '@/components/ProofUploader';
import { formatCurrency, getMonthName, getCurrentMonthYear } from '@/lib/utils';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface PropertyOption {
  id: string;
  name: string;
}

interface TenantOption {
  id: string;
  tenant_name: string;
  flat_no: string;
  monthly_rent: number;
  due_day: number;
  lease_start: string;
  property_id: string;
}

export default function LogPaymentScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const params = useLocalSearchParams<{ propertyId?: string; tenantId?: string }>();
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();

  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(params.propertyId ?? null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(params.tenantId ?? null);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [notes, setNotes] = useState('');
  const [proofPath, setProofPath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId);
  const tenantsForProperty = tenants.filter((t) => t.property_id === selectedPropertyId);

  useEffect(() => {
    loadProperties();
  }, [user?.id]);

  async function loadProperties() {
    if (!user?.id) return;
    const { data } = await supabase
      .from('properties')
      .select('id, name, tenants(id, tenant_name, flat_no, monthly_rent, due_day, lease_start, property_id, is_archived)')
      .eq('owner_id', user.id)
      .eq('is_archived', false);

    const props: PropertyOption[] = [];
    const allTenants: TenantOption[] = [];

    for (const p of data ?? []) {
      props.push({ id: p.id, name: p.name });
      const active = ((p.tenants as any[]) ?? []).filter((t: any) => !t.is_archived);
      allTenants.push(...active);
    }

    setProperties(props);
    setTenants(allTenants);

    // Auto-select first property/tenant if none passed
    if (!params.propertyId && props.length > 0) {
      setSelectedPropertyId(props[0].id);
      const first = allTenants.find((t) => t.property_id === props[0].id);
      if (first) {
        setSelectedTenantId(first.id);
        setAmount(String(first.monthly_rent));
      }
    } else if (params.tenantId) {
      const t = allTenants.find((x) => x.id === params.tenantId);
      if (t) setAmount(String(t.monthly_rent));
    }

    setLoadingData(false);
  }

  function selectProperty(propId: string) {
    setSelectedPropertyId(propId);
    const first = tenants.find((t) => t.property_id === propId);
    setSelectedTenantId(first?.id ?? null);
    setAmount(first ? String(first.monthly_rent) : '');
    setAmountError('');
    setProofPath(null);
  }

  function selectTenant(t: TenantOption) {
    setSelectedTenantId(t.id);
    setAmount(String(t.monthly_rent));
    setAmountError('');
    setProofPath(null);
  }

  async function handleSubmit() {
    if (!selectedTenant || !selectedPropertyId) {
      Alert.alert('Missing info', 'Please select a property and tenant.');
      return;
    }

    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setAmountError('Enter a valid amount greater than 0.');
      return;
    }
    setAmountError('');
    setSubmitting(true);

    try {
      // Look for an existing payment row
      const { data: existing } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', selectedTenant.id)
        .eq('month', selectedMonth)
        .eq('year', currentYear)
        .maybeSingle();

      if (existing) {
        // Update existing payment
        const totalPaid = existing.amount_paid + parsed;
        const newStatus = totalPaid >= existing.amount_due ? 'paid' : 'partial';
        const { error } = await supabase
          .from('payments')
          .update({
            amount_paid: totalPaid,
            status: newStatus,
            paid_at: new Date().toISOString(),
            notes: notes.trim() || existing.notes,
            proof_url: proofPath ?? existing.proof_url,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create a new payment row and mark as paid
        const amountDue = selectedTenant.monthly_rent;
        const totalPaid = parsed;
        const newStatus = totalPaid >= amountDue ? 'paid' : 'partial';
        const { error } = await supabase.from('payments').insert({
          tenant_id: selectedTenant.id,
          property_id: selectedPropertyId,
          month: selectedMonth,
          year: currentYear,
          amount_due: amountDue,
          amount_paid: totalPaid,
          status: newStatus,
          due_date: getDueDate(currentYear, selectedMonth, selectedTenant.due_day),
          paid_at: new Date().toISOString(),
          notes: notes.trim() || null,
          proof_url: proofPath ?? null,
        });

        if (error) throw error;
      }

      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save payment.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingData) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (properties.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No properties found. Add a property first.</Text>
      </View>
    );
  }

  const storagePath = selectedTenant
    ? getProofStoragePath(selectedPropertyId!, selectedTenant.id, currentYear, selectedMonth)
    : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Log Payment',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.textPrimary,
          presentation: 'modal',
          headerLeft: () => (
            <IconButton icon="close" size={22} onPress={() => router.back()} />
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Property selector */}
          <Text style={styles.fieldLabel}>Property</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ gap: 8 }}>
            {properties.map((p) => {
              const active = p.id === selectedPropertyId;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.chip, active && styles.chipActive]}
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
              <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Tenant</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ gap: 8 }}>
                {tenantsForProperty.map((t) => {
                  const active = t.id === selectedTenantId;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => selectTenant(t)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {t.tenant_name}
                      </Text>
                      <Text style={[styles.chipSub, active && { color: Colors.primary }]}>
                        {' · '}{t.flat_no}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : (
            <Text style={styles.hint}>No tenants in this property.</Text>
          )}

          {/* Month selector */}
          <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Month ({currentYear})</Text>
          <View style={styles.monthGrid}>
            {MONTHS.map((m) => {
              const active = m === selectedMonth;
              const isFuture = m > currentMonth;
              return (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.monthChip,
                    active && styles.monthChipActive,
                    isFuture && styles.monthChipDisabled,
                  ]}
                  onPress={() => !isFuture && setSelectedMonth(m)}
                  disabled={isFuture}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.monthChipText,
                    active && styles.monthChipTextActive,
                    isFuture && styles.monthChipTextDisabled,
                  ]}>
                    {MONTH_SHORT[m - 1]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Amount */}
          <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Amount</Text>
          {selectedTenant && (
            <Text style={styles.hint}>
              Monthly rent: {formatCurrency(selectedTenant.monthly_rent)}
            </Text>
          )}
          <TextInput
            mode="outlined"
            keyboardType="decimal-pad"
            placeholder="0.00"
            value={amount}
            onChangeText={(v) => { setAmount(v); setAmountError(''); }}
            left={<TextInput.Affix text="₹" />}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            error={!!amountError}
            style={styles.input}
          />
          {amountError ? <HelperText type="error">{amountError}</HelperText> : null}

          {/* Notes */}
          <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>
            Notes <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            mode="outlined"
            placeholder="e.g. Paid via UPI, ref #12345"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            style={styles.input}
          />

          {/* Proof upload */}
          {storagePath && (
            <ProofUploader
              storagePath={storagePath}
              onUploaded={(path) => setProofPath(path)}
            />
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || !selectedTenantId}
            style={styles.submitBtn}
            buttonColor={Colors.primary}
            contentStyle={styles.submitBtnContent}
          >
            Log Payment
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  fieldLabelSpaced: { marginTop: 20 },
  optional: { color: Colors.textDisabled, textTransform: 'none', fontWeight: '400' },
  hint: { fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
  chipRow: { flexDirection: 'row', marginBottom: 4 },
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
    backgroundColor: Colors.primary + '12',
  },
  chipText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary, fontWeight: '700' },
  chipSub: { fontSize: 12, color: Colors.textSecondary },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  monthChip: {
    width: '14%',
    minWidth: 48,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  monthChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '18',
  },
  monthChipDisabled: {
    backgroundColor: Colors.background,
    borderColor: Colors.border,
    opacity: 0.4,
  },
  monthChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  monthChipTextActive: { color: Colors.primary },
  monthChipTextDisabled: { color: Colors.textDisabled },
  input: { backgroundColor: Colors.surface },
  submitBtn: { marginTop: 24, borderRadius: 8 },
  submitBtnContent: { paddingVertical: 6 },
});
