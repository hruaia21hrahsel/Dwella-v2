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
// 6 columns, outer padding 16*2, gaps 5*8
const MONTH_CHIP_W = Math.floor((SCREEN_W - 32 - 40) / 6);

import { Text, TextInput, Button, ActivityIndicator, HelperText } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';
import { useToastStore } from '@/lib/toast';
import { getDueDate } from '@/lib/payments';
import { formatCurrency, getCurrentMonthYear } from '@/lib/utils';

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
  const insets = useSafeAreaInsets();
  const { user, session } = useAuthStore();
  const userId = user?.id ?? session?.user?.id;
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
  const [submitting, setSubmitting] = useState(false);

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId);
  const tenantsForProperty = tenants.filter((t) => t.property_id === selectedPropertyId);

  useEffect(() => {
    if (!userId || loadedRef.current) return;
    loadedRef.current = true;
    loadProperties();
  }, [userId]);

  async function loadProperties() {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name, tenants(id, tenant_name, flat_no, monthly_rent, due_day, lease_start, property_id, is_archived)')
        .eq('owner_id', userId)
        .eq('is_archived', false);

      if (error) throw error;

      const props: PropertyOption[] = [];
      const allTenants: TenantOption[] = [];

      for (const p of data ?? []) {
        props.push({ id: p.id, name: p.name });
        const active = ((p.tenants as any[]) ?? []).filter((t: any) => !t.is_archived);
        allTenants.push(...active);
      }

      setProperties(props);
      setTenants(allTenants);

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
    } catch (err: any) {
      useToastStore.getState().showToast(err.message ?? 'Failed to load properties.', 'error');
    } finally {
      setLoadingData(false);
    }
  }

  function selectProperty(propId: string) {
    setSelectedPropertyId(propId);
    const first = tenants.find((t) => t.property_id === propId);
    setSelectedTenantId(first?.id ?? null);
    setAmount(first ? String(first.monthly_rent) : '');
    setAmountError('');
  }

  function selectTenant(t: TenantOption) {
    setSelectedTenantId(t.id);
    setAmount(String(t.monthly_rent));
    setAmountError('');
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
      const { data: existing } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', selectedTenant.id)
        .eq('month', selectedMonth)
        .eq('year', currentYear)
        .maybeSingle();

      if (existing) {
        const totalPaid = existing.amount_paid + parsed;
        const newStatus = totalPaid >= existing.amount_due ? 'paid' : 'partial';
        const { error } = await supabase
          .from('payments')
          .update({ amount_paid: totalPaid, status: newStatus, paid_at: new Date().toISOString(), notes: notes.trim() || existing.notes })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
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
      <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.textPrimary }]}>Log Payment</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Body */}
      <View style={[styles.body, { paddingBottom: insets.bottom + 12 }]}>

        {/* Property */}
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Property</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {properties.map((p, i) => {
              const active = p.id === selectedPropertyId;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.chip,
                    { borderColor: colors.border, backgroundColor: colors.background },
                    active && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                    i < properties.length - 1 && { marginRight: 8 },
                  ]}
                  onPress={() => selectProperty(p.id)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={active ? 'home-city' : 'home-city-outline'}
                    size={14}
                    color={active ? colors.primary : colors.textSecondary}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.chipText, { color: colors.textSecondary }, active && { color: colors.primary, fontWeight: '700' }]}>
                    {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Tenant */}
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Tenant</Text>
          {tenantsForProperty.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {tenantsForProperty.map((t, i) => {
                const active = t.id === selectedTenantId;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.chip,
                      { borderColor: colors.border, backgroundColor: colors.background },
                      active && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                      i < tenantsForProperty.length - 1 && { marginRight: 8 },
                    ]}
                    onPress={() => selectTenant(t)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={active ? 'account' : 'account-outline'}
                      size={14}
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
          ) : (
            <Text style={[styles.chipText, { color: colors.textDisabled }]}>No tenants</Text>
          )}
        </View>

        {/* Context strip */}
        {selectedTenant && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={[styles.contextStrip, { backgroundColor: colors.primarySoft, borderColor: colors.primaryLight }]}>
              <View style={styles.contextItem}>
                <Text style={[styles.contextLabel, { color: colors.primaryDark }]}>Rent</Text>
                <Text style={[styles.contextValue, { color: colors.primaryDark }]}>{formatCurrency(selectedTenant.monthly_rent)}</Text>
              </View>
              <View style={[styles.contextDivider, { backgroundColor: colors.primaryLight }]} />
              <View style={styles.contextItem}>
                <Text style={[styles.contextLabel, { color: colors.primaryDark }]}>Due</Text>
                <Text style={[styles.contextValue, { color: colors.primaryDark }]}>
                  {selectedTenant.due_day}{getOrdinalSuffix(selectedTenant.due_day)}
                </Text>
              </View>
              <View style={[styles.contextDivider, { backgroundColor: colors.primaryLight }]} />
              <View style={styles.contextItem}>
                <Text style={[styles.contextLabel, { color: colors.primaryDark }]}>Flat</Text>
                <Text style={[styles.contextValue, { color: colors.primaryDark }]}>{selectedTenant.flat_no}</Text>
              </View>
            </View>
          </>
        )}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Month */}
        <View>
          <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 8 }]}>Month — {currentYear}</Text>
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
                    isFuture && { opacity: 0.3 },
                  ]}
                  onPress={() => !isFuture && setSelectedMonth(m)}
                  disabled={isFuture}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.monthChipText,
                    { color: colors.textSecondary },
                    active && { color: colors.primary, fontWeight: '700' },
                  ]}>
                    {MONTH_SHORT[m - 1]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Amount + Notes */}
        <View style={styles.inputRow}>
          <View style={styles.amountWrap}>
            <TextInput
              label="Amount"
              mode="outlined"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={(v) => { setAmount(v); setAmountError(''); }}
              left={<TextInput.Affix text="₹" />}
              error={!!amountError}
              dense
              style={{ backgroundColor: colors.surface }}
              outlineStyle={styles.inputOutline}
            />
            {amountError ? <HelperText type="error" style={styles.helperText}>{amountError}</HelperText> : null}
          </View>
          <View style={styles.notesWrap}>
            <TextInput
              label="Notes (optional)"
              mode="outlined"
              value={notes}
              onChangeText={setNotes}
              dense
              style={{ backgroundColor: colors.surface }}
              outlineStyle={styles.inputOutline}
            />
          </View>
        </View>

        {/* Submit */}
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
      </View>
    </KeyboardAvoidingView>
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
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
  },

  // Body
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
  },

  // Label
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  // Row (label + horizontal chips)
  row: { gap: 6 },
  chipScroll: { flexDirection: 'row' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  chipSub: { fontSize: 12 },

  divider: { height: StyleSheet.hairlineWidth },

  // Context strip
  contextStrip: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  contextItem: { flex: 1, alignItems: 'center' },
  contextDivider: { width: 1, height: 24 },
  contextLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  contextValue: { fontSize: 14, fontWeight: '800' },

  // Month grid
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthChip: {
    width: MONTH_CHIP_W,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  monthChipText: { fontSize: 12, fontWeight: '600' },

  // Inputs
  inputRow: { flexDirection: 'row', gap: 10 },
  amountWrap: { flex: 1 },
  notesWrap: { flex: 1 },
  inputOutline: { borderRadius: 10 },
  helperText: { marginTop: -4 },

  // Submit
  submitBtn: { borderRadius: 12 },
  submitBtnContent: { paddingVertical: 6 },
});
