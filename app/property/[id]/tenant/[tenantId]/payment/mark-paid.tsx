import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Payment } from '@/lib/types';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, getMonthName } from '@/lib/utils';
import { getProofStoragePath } from '@/lib/payments';
import { ProofUploader } from '@/components/ProofUploader';
import { useAuthStore } from '@/lib/store';
import { useToastStore } from '@/lib/toast';
import { useTrack, EVENTS } from '@/lib/analytics';

export default function MarkPaidScreen() {
  const { id: propertyId, tenantId, paymentId } = useLocalSearchParams<{
    id: string;
    tenantId: string;
    paymentId: string;
  }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const track = useTrack();

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
      useToastStore.getState().showToast(error.message, 'error');
    } else {
      track(EVENTS.PAYMENT_MARKED_PAID, {
        payment_id: payment.id,
        tenant_id: tenantId,
        has_proof: !!proofPath,
      });
      if (proofPath) {
        track(EVENTS.PAYMENT_PROOF_UPLOADED, { payment_id: payment.id });
      }
      router.back();
    }

    setSubmitting(false);
  }

  if (loading || !payment) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  const storagePath = getProofStoragePath(propertyId, tenantId, payment.year, payment.month);
  const remaining = payment.amount_due - payment.amount_paid;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          presentation: 'modal',
          title: 'Mark as Paid',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.background } as object,
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
        }}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text variant="titleMedium" style={[styles.month, { color: colors.textPrimary }]}>
              {getMonthName(payment.month)} {payment.year}
            </Text>
            <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
              Total Due: {formatCurrency(payment.amount_due)}
            </Text>
            {payment.amount_paid > 0 && (
              <Text variant="bodySmall" style={{ color: colors.statusConfirmed }}>
                Already Paid: {formatCurrency(payment.amount_paid)}
              </Text>
            )}
            <Text variant="bodyMedium" style={[styles.remainingText, { color: colors.primary }]}>
              Remaining: {formatCurrency(remaining)}
            </Text>
          </View>

          <TextInput
            label="Amount Paying (₹)"
            value={amountPaid}
            onChangeText={(v) => { setAmountPaid(v); setAmountError(''); }}
            keyboardType="decimal-pad"
            mode="outlined"
            style={[styles.input, { backgroundColor: colors.surface }]}
            error={!!amountError}
          />
          {amountError ? <HelperText type="error">{amountError}</HelperText> : null}

          <TextInput
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            mode="outlined"
            style={[styles.input, { backgroundColor: colors.surface }]}
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
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  summaryCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 8,
    marginBottom: 4,
  },
  month: { fontWeight: '700' },
  remainingText: { fontWeight: '600', marginTop: 4 },
  input: {},
  button: { marginTop: 8 },
  buttonContent: { paddingVertical: 6 },
});
