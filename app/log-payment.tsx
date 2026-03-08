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
import { useTheme } from '@/lib/theme-context';
import { useToastStore } from '@/lib/toast';
import { getDueDate, getProofStoragePath } from '@/lib/payments';
import { ProofUploader } from '@/components/ProofUploader';
import { formatCurrency, getCurrentMonthYear } from '@/lib/utils';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <MaterialCommunityIcons name={icon as any} size={18} color={colors.primary} />
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
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
  const { colors, shadows } = useTheme();
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
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (properties.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No properties found. Add a property first.</Text>
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
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Page title */}
          <View style={styles.pageHeader}>
            <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Log Payment</Text>
            <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>Record a rent payment for a tenant</Text>
          </View>

          {/* Property & Tenant selector */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SectionHeader icon="home-city-outline" title="Property & Tenant" />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Property</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {properties.map((p, i) => {
                const active = p.id === selectedPropertyId;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.chip,
                      { borderColor: colors.border, backgroundColor: colors.background },
                      active && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                      i < properties.length - 1 && styles.chipMargin,
                    ]}
                    onPress={() => selectProperty(p.id)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={active ? 'home-city' : 'home-city-outline'}
                      size={15}
                      color={active ? colors.primary : colors.textSecondary}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[styles.chipText, { color: colors.textSecondary }, active && { color: colors.primary, fontWeight: '700' }]}>{p.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {tenantsForProperty.length > 0 ? (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 12, color: colors.textSecondary }]}>Tenant</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  {tenantsForProperty.map((t, i) => {
                    const active = t.id === selectedTenantId;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.chip,
                          { borderColor: colors.border, backgroundColor: colors.background },
                          active && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                          i < tenantsForProperty.length - 1 && styles.chipMargin,
                        ]}
                        onPress={() => selectTenant(t)}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons
                          name={active ? 'account' : 'account-outline'}
                          size={15}
                          color={active ? colors.primary : colors.textSecondary}
                          style={{ marginRight: 5 }}
                        />
                        <Text style={[styles.chipText, { color: colors.textSecondary }, active && { color: colors.primary, fontWeight: '700' }]}>
                          {t.tenant_name}
                        </Text>
                        <Text style={[styles.chipSub, { color: colors.textSecondary }, active && { color: colors.primary }]}>
                          {' · '}{t.flat_no}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            ) : (
              <View style={styles.noTenantRow}>
                <MaterialCommunityIcons name="account-alert-outline" size={16} color={colors.textDisabled} />
                <Text style={[styles.noTenantText, { color: colors.textDisabled }]}>No tenants in this property.</Text>
              </View>
            )}
          </View>

          {/* Rent context summary — only when tenant selected */}
          {selectedTenant && (
            <View style={[styles.contextCard, { backgroundColor: colors.primarySoft, borderColor: colors.primaryLight }]}>
              <View style={styles.contextRow}>
                <View style={styles.contextItem}>
                  <Text style={[styles.contextLabel, { color: colors.primaryDark }]}>Monthly Rent</Text>
                  <Text style={[styles.contextValue, { color: colors.primaryDark }]}>{formatCurrency(selectedTenant.monthly_rent)}</Text>
                </View>
                <View style={[styles.contextDivider, { backgroundColor: colors.primaryLight }]} />
                <View style={styles.contextItem}>
                  <Text style={[styles.contextLabel, { color: colors.primaryDark }]}>Due Day</Text>
                  <Text style={[styles.contextValue, { color: colors.primaryDark }]}>{selectedTenant.due_day}<Text style={styles.contextSuffix}>{getOrdinalSuffix(selectedTenant.due_day)}</Text></Text>
                </View>
                <View style={[styles.contextDivider, { backgroundColor: colors.primaryLight }]} />
                <View style={styles.contextItem}>
                  <Text style={[styles.contextLabel, { color: colors.primaryDark }]}>Flat</Text>
                  <Text style={[styles.contextValue, { color: colors.primaryDark }]}>{selectedTenant.flat_no}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Month selector */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
                      { borderColor: colors.border, backgroundColor: colors.background },
                      active && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                      isFuture && { backgroundColor: colors.background, borderColor: colors.border, opacity: 0.35 },
                    ]}
                    onPress={() => !isFuture && setSelectedMonth(m)}
                    disabled={isFuture}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.monthChipText,
                      { color: colors.textSecondary },
                      active && { color: colors.primary, fontWeight: '700' },
                      isFuture && { color: colors.textDisabled },
                    ]}>
                      {MONTH_SHORT[m - 1]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Payment Details */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
              style={[styles.input, { backgroundColor: colors.surface }]}
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
              style={[styles.input, { backgroundColor: colors.surface }]}
              outlineStyle={styles.inputOutline}
            />
          </View>

          {/* Proof upload */}
          {storagePath && (
            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
            style={[styles.submitBtn, shadows.sm]}
            buttonColor={colors.primary}
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
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { textAlign: 'center', paddingHorizontal: 32 },

  // Page header
  pageHeader: {
    gap: 4,
    paddingBottom: 4,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  pageSubtitle: {
    fontSize: 14,
  },

  // Section cards
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Field labels
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
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
  },
  chipMargin: {
    marginRight: 8,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  chipSub: { fontSize: 12 },

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
  },

  // Context summary card
  contextCard: {
    borderRadius: 14,
    borderWidth: 1,
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
  },
  contextLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  contextValue: {
    fontSize: 16,
    fontWeight: '800',
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
    alignItems: 'center',
  },
  monthChipText: { fontSize: 12, fontWeight: '600' },

  // Inputs
  input: {},
  inputOutline: { borderRadius: 12 },

  // Submit
  submitBtn: {
    marginTop: 4,
    borderRadius: 14,
  },
  submitBtnContent: { paddingVertical: 10 },
});
