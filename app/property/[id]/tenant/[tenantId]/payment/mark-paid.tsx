import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Payment } from '@/lib/types';
import { Colors } from '@/constants/colors';
import { formatCurrency, getMonthName } from '@/lib/utils';
import { getProofStoragePath } from '@/lib/payments';
import { ProofUploader } from '@/components/ProofUploader';
import { useAuthStore } from '@/lib/store';

export default function MarkPaidScreen() {
  const { id: propertyId, tenantId, paymentId } = useLocalSearchParams<{
    id: string;
    tenantId: string;
    paymentId: string;
  }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [proofPath, setProofPath] = useState<string | null>(null);
  const [amountError, setAmountError] = useState('');

  useEffect(() => {
    fetchPayment();
  }, [paymentId]);

  async function fetchPayment() {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single<Payment>();

    if (data) {
      setPayment(data);
      const remaining = data.amount_due - data.amount_paid;
      setAmountPaid(String(remaining));
    }
    setLoading(false);
  }

  async function handleSubmit() {
    if (!payment) return;

    const amount = parseFloat(amountPaid);
    if (isNaN(amount) || amount <= 0) {
      setAmountError('Enter a valid amount.');
      return;
    }
    if (amount > payment.amount_due) {
      setAmountError(`Cannot exceed total due (${formatCurrency(payment.amount_due)}).`);
      return;
    }

    setAmountError('');
    setSubmitting(true);

    const totalPaid = payment.amount_paid + amount;
    const newStatus = totalPaid >= payment.amount_due ? 'paid' : 'partial';

    const { error } = await supabase
      .from('payments')
      .update({
        amount_paid: totalPaid,
        status: newStatus,
        paid_at: new Date().toISOString(),
        proof_url: proofPath,
        notes: notes.trim() || null,
      })
      .eq('id', payment.id);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.back();
    }

    setSubmitting(false);
  }

  if (loading || !payment) {
    return <View style={styles.container} />;
  }

  const storagePath = getProofStoragePath(propertyId, tenantId, payment.year, payment.month);
  const remaining = payment.amount_due - payment.amount_paid;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Mark as Paid',
          headerTitleAlign: 'center',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.surface, height: 64 },
          headerTintColor: Colors.textPrimary,
          presentation: 'modal',
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.summaryCard}>
            <Text variant="titleMedium" style={styles.month}>
              {getMonthName(payment.month)} {payment.year}
            </Text>
            <Text variant="bodyMedium" style={styles.dueText}>
              Total Due: {formatCurrency(payment.amount_due)}
            </Text>
            {payment.amount_paid > 0 && (
              <Text variant="bodySmall" style={styles.paidText}>
                Already Paid: {formatCurrency(payment.amount_paid)}
              </Text>
            )}
            <Text variant="bodyMedium" style={styles.remainingText}>
              Remaining: {formatCurrency(remaining)}
            </Text>
          </View>

          <TextInput
            label="Amount Paying (₹)"
            value={amountPaid}
            onChangeText={(v) => { setAmountPaid(v); setAmountError(''); }}
            keyboardType="decimal-pad"
            mode="outlined"
            style={styles.input}
            error={!!amountError}
          />
          {amountError ? <HelperText type="error">{amountError}</HelperText> : null}

          <TextInput
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={2}
          />

          <ProofUploader
            storagePath={storagePath}
            onUploaded={(path) => setProofPath(path)}
          />

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            Submit Payment
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 12 },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
    marginBottom: 4,
  },
  month: { color: Colors.textPrimary, fontWeight: '700' },
  dueText: { color: Colors.textSecondary },
  paidText: { color: Colors.statusConfirmed },
  remainingText: { color: Colors.primary, fontWeight: '600', marginTop: 4 },
  input: { backgroundColor: Colors.surface },
  button: { marginTop: 8 },
  buttonContent: { paddingVertical: 6 },
});
