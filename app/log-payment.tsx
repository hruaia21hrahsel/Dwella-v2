import { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
// 6 columns, card padding 16*2, section card padding 16*2, gaps 5*8
const MONTH_CHIP_W = Math.floor((SCREEN_W - 32 - 32 - 40) / 6);

import { Text, TextInput, Button, ActivityIndicator, HelperText, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Colors, Shadows } from '@/constants/colors';
import { useToastStore } from '@/lib/toast';
import { getDueDate, getProofStoragePath } from '@/lib/payments';
import { ProofUploader } from '@/components/ProofUploader';
import { formatCurrency, getCurrentMonthYear } from '@/lib/utils';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <MaterialCommunityIcons name={icon as any} size={18} color={Colors.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

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
  const loadedRef = useRef(false);

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
    if (!user?.id || loadedRef.current) return;
    loadedRef.current = true;
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
      useToastStore.getState().showToast('Please select a property and tenant.', 'error');
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
      useToastStore.getState().showToast(err.message ?? 'Could not save payment.', 'error');
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

          {/* Page title */}
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>Log Payment</Text>
            <Text style={styles.pageSubtitle}>Record a rent payment for a tenant</Text>
          </View>

          {/* Property & Tenant selector */}
          <View style={styles.sectionCard}>
            <SectionHeader icon="home-city-outline" title="Property & Tenant" />

            <Text style={styles.fieldLabel}>Property</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {properties.map((p, i) => {
                const active = p.id === selectedPropertyId;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.chip, active && styles.chipActive, i < properties.length - 1 && styles.chipMargin]}
                    onPress={() => selectProperty(p.id)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={active ? 'home-city' : 'home-city-outline'}
                      size={15}
                      color={active ? Colors.primary : Colors.textSecondary}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {tenantsForProperty.length > 0 ? (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Tenant</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  {tenantsForProperty.map((t, i) => {
                    const active = t.id === selectedTenantId;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.chip, active && styles.chipActive, i < tenantsForProperty.length - 1 && styles.chipMargin]}
                        onPress={() => selectTenant(t)}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons
                          name={active ? 'account' : 'account-outline'}
                          size={15}
                          color={active ? Colors.primary : Colors.textSecondary}
                          style={{ marginRight: 5 }}
                        />
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
              <View style={styles.noTenantRow}>
                <MaterialCommunityIcons name="account-alert-outline" size={16} color={Colors.textDisabled} />
                <Text style={styles.noTenantText}>No tenants in this property.</Text>
              </View>
            )}
          </View>

          {/* Rent context summary — only when tenant selected */}
          {selectedTenant && (
            <View style={styles.contextCard}>
              <View style={styles.contextRow}>
                <View style={styles.contextItem}>
                  <Text style={styles.contextLabel}>Monthly Rent</Text>
                  <Text style={styles.contextValue}>{formatCurrency(selectedTenant.monthly_rent)}</Text>
                </View>
                <View style={styles.contextDivider} />
                <View style={styles.contextItem}>
                  <Text style={styles.contextLabel}>Due Day</Text>
                  <Text style={styles.contextValue}>{selectedTenant.due_day}<Text style={styles.contextSuffix}>{getOrdinalSuffix(selectedTenant.due_day)}</Text></Text>
                </View>
                <View style={styles.contextDivider} />
                <View style={styles.contextItem}>
                  <Text style={styles.contextLabel}>Flat</Text>
                  <Text style={styles.contextValue}>{selectedTenant.flat_no}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Month selector */}
          <View style={styles.sectionCard}>
            <SectionHeader icon="calendar-month-outline" title={`Month (${currentYear})`} />
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
          </View>

          {/* Payment Details */}
          <View style={styles.sectionCard}>
            <SectionHeader icon="currency-inr" title="Payment Details" />

            <TextInput
              label="Amount"
              mode="outlined"
              keyboardType="decimal-pad"
              placeholder="0.00"
              value={amount}
              onChangeText={(v) => { setAmount(v); setAmountError(''); }}
              left={<TextInput.Affix text="₹" />}
              error={!!amountError}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />
            {amountError ? <HelperText type="error">{amountError}</HelperText> : null}

            <TextInput
              label="Notes (optional)"
              mode="outlined"
              placeholder="e.g. Paid via UPI, ref #12345"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />
          </View>

          {/* Proof upload */}
          {storagePath && (
            <View style={styles.sectionCard}>
              <SectionHeader icon="camera-outline" title="Payment Proof" />
              <ProofUploader
                storagePath={storagePath}
                onUploaded={(path) => setProofPath(path)}
              />
            </View>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || !selectedTenantId}
            style={styles.submitBtn}
            buttonColor={Colors.primary}
            contentStyle={styles.submitBtnContent}
            icon="check-circle-outline"
          >
            Log Payment
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function getOrdinalSuffix(n: number): string {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },

  // Page header
  pageHeader: {
    gap: 4,
    paddingBottom: 4,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },

  // Section cards
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Field labels
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Chips
  chipRow: { flexDirection: 'row' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  chipMargin: {
    marginRight: 8,
  },
  chipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  chipText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary, fontWeight: '700' },
  chipSub: { fontSize: 12, color: Colors.textSecondary },

  // No tenant hint
  noTenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  noTenantText: {
    fontSize: 13,
    color: Colors.textDisabled,
  },

  // Context summary card
  contextCard: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    padding: 14,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contextItem: {
    flex: 1,
    alignItems: 'center',
  },
  contextDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.primaryLight,
  },
  contextLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  contextValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  contextSuffix: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Month grid
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthChip: {
    width: MONTH_CHIP_W,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  monthChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  monthChipDisabled: {
    backgroundColor: Colors.background,
    borderColor: Colors.border,
    opacity: 0.35,
  },
  monthChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  monthChipTextActive: { color: Colors.primary, fontWeight: '700' },
  monthChipTextDisabled: { color: Colors.textDisabled },

  // Inputs
  input: { backgroundColor: Colors.surface },
  inputOutline: { borderRadius: 12 },

  // Submit
  submitBtn: {
    marginTop: 4,
    borderRadius: 14,
    ...Shadows.sm,
  },
  submitBtnContent: { paddingVertical: 10 },
});
