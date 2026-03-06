import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, Share } from 'react-native';
import { TextInput, Button, HelperText, Text, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { Tenant } from '@/lib/types';

export default function TenantCreateScreen() {
  const { id: propertyId, tenantId } = useLocalSearchParams<{ id: string; tenantId?: string }>();
  const router = useRouter();
  const isEditing = !!tenantId;

  const [flatNo, setFlatNo] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('0');
  const [dueDay, setDueDay] = useState('1');
  const [leaseStart, setLeaseStart] = useState('');
  const [leaseEnd, setLeaseEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isEditing) return;

    async function fetchTenant() {
      const { data } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single<Tenant>();

      if (data) {
        setFlatNo(data.flat_no);
        setTenantName(data.tenant_name);
        setMonthlyRent(String(data.monthly_rent));
        setSecurityDeposit(String(data.security_deposit));
        setDueDay(String(data.due_day));
        setLeaseStart(data.lease_start);
        setLeaseEnd(data.lease_end ?? '');
      }
      setFetching(false);
    }

    fetchTenant();
  }, [tenantId, isEditing]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!flatNo.trim()) errs.flatNo = 'Flat/unit number is required.';
    if (!tenantName.trim()) errs.tenantName = 'Tenant name is required.';
    const rent = parseFloat(monthlyRent);
    if (isNaN(rent) || rent <= 0) errs.monthlyRent = 'Enter a valid rent amount.';
    const day = parseInt(dueDay, 10);
    if (isNaN(day) || day < 1 || day > 28) errs.dueDay = 'Due day must be between 1 and 28.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);

    const payload = {
      flat_no: flatNo.trim(),
      tenant_name: tenantName.trim(),
      monthly_rent: parseFloat(monthlyRent),
      security_deposit: parseFloat(securityDeposit) || 0,
      due_day: parseInt(dueDay, 10),
      lease_start: leaseStart || null,
      lease_end: leaseEnd || null,
    };

    if (isEditing) {
      const { error } = await supabase
        .from('tenants')
        .update(payload)
        .eq('id', tenantId);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        router.back();
      }
    } else {
      const { data, error } = await supabase
        .from('tenants')
        .insert({ ...payload, property_id: propertyId })
        .select('invite_token')
        .single();

      if (error) {
        Alert.alert('Error', error.message);
      } else if (data) {
        // Show invite link share modal
        const inviteLink = `dwella://invite/${data.invite_token}`;
        await Share.share({
          message: `You've been added as a tenant on Dwella! Open this link to accept your invitation:\n\n${inviteLink}`,
          title: 'Tenant Invite',
        });
        router.back();
      }
    }

    setLoading(false);
  }

  if (fetching) {
    return <View style={styles.container} />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditing ? 'Edit Tenant' : 'Add Tenant',
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.textPrimary,
          headerShown: true,
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
          <TextInput
            label="Flat / Unit Number"
            value={flatNo}
            onChangeText={setFlatNo}
            mode="outlined"
            style={styles.input}
            error={!!errors.flatNo}
          />
          {errors.flatNo && <HelperText type="error">{errors.flatNo}</HelperText>}

          <TextInput
            label="Tenant Name"
            value={tenantName}
            onChangeText={setTenantName}
            mode="outlined"
            style={styles.input}
            error={!!errors.tenantName}
          />
          {errors.tenantName && <HelperText type="error">{errors.tenantName}</HelperText>}

          <TextInput
            label="Monthly Rent (₹)"
            value={monthlyRent}
            onChangeText={setMonthlyRent}
            keyboardType="decimal-pad"
            mode="outlined"
            style={styles.input}
            error={!!errors.monthlyRent}
          />
          {errors.monthlyRent && <HelperText type="error">{errors.monthlyRent}</HelperText>}

          <TextInput
            label="Security Deposit (₹)"
            value={securityDeposit}
            onChangeText={setSecurityDeposit}
            keyboardType="decimal-pad"
            mode="outlined"
            style={styles.input}
          />

          <TextInput
            label="Due Day (1–28)"
            value={dueDay}
            onChangeText={setDueDay}
            keyboardType="number-pad"
            mode="outlined"
            style={styles.input}
            error={!!errors.dueDay}
          />
          {errors.dueDay && <HelperText type="error">{errors.dueDay}</HelperText>}

          <TextInput
            label="Lease Start (YYYY-MM-DD, optional)"
            value={leaseStart}
            onChangeText={setLeaseStart}
            mode="outlined"
            style={styles.input}
            placeholder="2024-01-01"
          />

          <TextInput
            label="Lease End (YYYY-MM-DD, optional)"
            value={leaseEnd}
            onChangeText={setLeaseEnd}
            mode="outlined"
            style={styles.input}
            placeholder="2025-01-01"
          />

          {!isEditing && (
            <Text variant="bodySmall" style={styles.inviteNote}>
              After saving, an invite link will be generated and shared with the tenant.
            </Text>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            {isEditing ? 'Save Changes' : 'Add Tenant & Share Invite'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    gap: 4,
  },
  input: {
    backgroundColor: Colors.surface,
  },
  inviteNote: {
    color: Colors.textSecondary,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  button: {
    marginTop: 16,
  },
  buttonContent: {
    paddingVertical: 6,
  },
});
