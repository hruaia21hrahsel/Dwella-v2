import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, Modal } from 'react-native';
import { Text, Button, Divider, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Payment, Tenant, Property } from '@/lib/types';
import { useTheme } from '@/lib/theme-context';
import { sharePaymentReceipt } from '@/lib/pdf';
import { useToastStore } from '@/lib/toast';
import { formatCurrency, formatDate, getMonthName } from '@/lib/utils';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { canConfirm, getProofSignedUrl } from '@/lib/payments';
import { useProperties } from '@/hooks/useProperties';

export default function PaymentDetailScreen() {
  const { id: propertyId, tenantId, paymentId } = useLocalSearchParams<{
    id: string;
    tenantId: string;
    paymentId: string;
  }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { ownedProperties } = useProperties();
  const isOwner = ownedProperties.some((p) => p.id === propertyId);

  const [payment, setPayment] = useState<Payment | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [landlordName, setLandlordName] = useState('');
  const [loading, setLoading] = useState(true);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [proofFullscreen, setProofFullscreen] = useState(false);

  useEffect(() => {
    fetchPayment();
  }, [paymentId]);

  async function fetchPayment() {
    setLoading(true);
    const [{ data: paymentData }, { data: tenantData }, { data: propertyData }] = await Promise.all([
      supabase.from('payments').select('*').eq('id', paymentId).single<Payment>(),
      supabase.from('tenants').select('*').eq('id', tenantId).single<Tenant>(),
      supabase.from('properties').select('*').eq('id', propertyId).single<Property>(),
    ]);
    setPayment(paymentData);
    setTenant(tenantData);
    setProperty(propertyData);

    if (paymentData?.proof_url) {
      const url = await getProofSignedUrl(paymentData.proof_url);
      setProofUrl(url);
    }

    if (propertyData?.owner_id) {
      const { data: ownerData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', propertyData.owner_id)
        .single();
      setLandlordName(ownerData?.full_name ?? 'Landlord');
    }

    setLoading(false);
  }

  async function handleConfirm() {
    if (!payment) return;
    setConfirming(true);
    const { error } = await supabase
      .from('payments')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        auto_confirmed: false,
      })
      .eq('id', payment.id);
    if (error) useToastStore.getState().showToast(error.message, 'error');
    else fetchPayment();
    setConfirming(false);
  }

  async function handleShareReceipt() {
    if (!payment || !tenant || !property) return;
    setSharing(true);
    try {
      await sharePaymentReceipt(payment, tenant, property, landlordName);
    } catch (err) {
      useToastStore.getState().showToast('Export failed: ' + String(err), 'error');
    } finally {
      setSharing(false);
    }
  }

  async function handleReset() {
    if (!payment) return;
    Alert.alert(
      'Reset to Pending',
      'This will clear the payment record and proof. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            const { error } = await supabase
              .from('payments')
              .update({
                status: 'pending',
                amount_paid: 0,
                paid_at: null,
                confirmed_at: null,
                proof_url: null,
                notes: null,
                auto_confirmed: false,
              })
              .eq('id', payment.id);
            if (error) useToastStore.getState().showToast(error.message, 'error');
            else fetchPayment();
            setResetting(false);
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!payment) {
    return <View style={styles.centered}><Text>Payment not found.</Text></View>;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `${getMonthName(payment.month)} ${payment.year}`,
          headerTitleAlign: 'center',
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface, height: 64 } as any,
          headerTintColor: colors.textPrimary,
        }}
      />

      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="headlineSmall" style={[styles.monthTitle, { color: colors.textPrimary }]}>
            {getMonthName(payment.month)} {payment.year}
          </Text>
          <PaymentStatusBadge status={payment.status} compact={false} />
        </View>

        {/* Amounts */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardRow}>
            <Text variant="bodySmall" style={{ color: colors.textSecondary }}>Amount Due</Text>
            <Text variant="bodyLarge" style={{ color: colors.textPrimary, fontWeight: '500' }}>{formatCurrency(payment.amount_due)}</Text>
          </View>
          <Divider />
          <View style={styles.cardRow}>
            <Text variant="bodySmall" style={{ color: colors.textSecondary }}>Amount Paid</Text>
            <Text variant="bodyLarge" style={{ color: colors.statusConfirmed, fontWeight: '500' }}>
              {formatCurrency(payment.amount_paid)}
            </Text>
          </View>
          {payment.amount_paid < payment.amount_due && (
            <>
              <Divider />
              <View style={styles.cardRow}>
                <Text variant="bodySmall" style={{ color: colors.textSecondary }}>Balance</Text>
                <Text variant="bodyLarge" style={{ color: colors.statusOverdue, fontWeight: '500' }}>
                  {formatCurrency(payment.amount_due - payment.amount_paid)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Timeline */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardRow}>
            <Text variant="bodySmall" style={{ color: colors.textSecondary }}>Due Date</Text>
            <Text variant="bodyMedium" style={{ color: colors.textPrimary, fontWeight: '500' }}>{formatDate(payment.due_date)}</Text>
          </View>
          {payment.paid_at && (
            <>
              <Divider />
              <View style={styles.cardRow}>
                <Text variant="bodySmall" style={{ color: colors.textSecondary }}>Marked Paid</Text>
                <Text variant="bodyMedium" style={{ color: colors.textPrimary, fontWeight: '500' }}>{formatDate(payment.paid_at)}</Text>
              </View>
            </>
          )}
          {payment.confirmed_at && (
            <>
              <Divider />
              <View style={styles.cardRow}>
                <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                  {payment.auto_confirmed ? 'Auto-confirmed' : 'Confirmed'}
                </Text>
                <Text variant="bodyMedium" style={{ color: colors.textPrimary, fontWeight: '500' }}>{formatDate(payment.confirmed_at)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Notes */}
        {payment.notes ? (
          <View style={[styles.notesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text variant="labelMedium" style={{ color: colors.textSecondary }}>Notes</Text>
            <Text variant="bodyMedium">{payment.notes}</Text>
          </View>
        ) : null}

        {/* Proof */}
        {proofUrl ? (
          <View style={styles.proofSection}>
            <Text variant="labelMedium" style={{ color: colors.textSecondary }}>Payment Proof</Text>
            <TouchableOpacity onPress={() => setProofFullscreen(true)}>
              <Image source={{ uri: proofUrl }} style={[styles.proofThumb, { borderColor: colors.border }]} resizeMode="cover" />
              <Text variant="bodySmall" style={[styles.tapHint, { color: colors.textSecondary }]}>Tap to view full screen</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* AI Suggestions */}
        {isOwner && payment.status === 'paid' && (
          <View style={[styles.suggestionCard, { backgroundColor: colors.primarySoft, borderColor: colors.primaryLight }]}>
            <MaterialCommunityIcons name="lightbulb-outline" size={16} color={colors.primary} />
            <Text style={[styles.suggestionText, { color: colors.primaryDark }]}>
              Payment marked as paid. Consider confirming promptly to keep records clean.
            </Text>
          </View>
        )}
        {isOwner && payment.status === 'overdue' && (
          <View style={[styles.suggestionCard, { backgroundColor: colors.statusOverdueSoft, borderColor: colors.error }]}>
            <MaterialCommunityIcons name="alert-outline" size={16} color={colors.statusOverdue} />
            <Text style={[styles.suggestionText, { color: colors.error }]}>
              {Math.max(1, Math.floor((Date.now() - new Date(payment.due_date).getTime()) / (1000 * 60 * 60 * 24)))} days overdue. Consider sending a reminder to {tenant?.tenant_name ?? 'the tenant'}.
            </Text>
          </View>
        )}
        {isOwner && payment.status === 'partial' && (
          <View style={[styles.suggestionCard, { backgroundColor: colors.statusPartialSoft, borderColor: colors.warning }]}>
            <MaterialCommunityIcons name="information-outline" size={16} color={colors.statusPartial} />
            <Text style={[styles.suggestionText, { color: colors.warning }]}>
              {formatCurrency(payment.amount_due - payment.amount_paid)} remaining. Follow up with {tenant?.tenant_name ?? 'the tenant'} for the balance.
            </Text>
          </View>
        )}

        {/* Actions */}
        {payment.amount_paid > 0 && tenant && property && (
          <Button
            mode="outlined"
            icon="share-variant"
            onPress={handleShareReceipt}
            loading={sharing}
            disabled={sharing}
            style={styles.actionBtn}
          >
            Share Receipt
          </Button>
        )}

        {isOwner && canConfirm(payment.status) && (
          <Button
            mode="contained"
            icon="check-circle"
            onPress={handleConfirm}
            loading={confirming}
            disabled={confirming}
            buttonColor={colors.statusConfirmed}
            style={styles.actionBtn}
            contentStyle={styles.actionBtnContent}
          >
            Confirm Payment
          </Button>
        )}

        {isOwner && (payment.status === 'paid' || payment.status === 'partial') && (
          <Button
            mode="outlined"
            icon="refresh"
            onPress={handleReset}
            loading={resetting}
            disabled={resetting}
            textColor={colors.error}
            style={[styles.actionBtn, { borderColor: colors.error }]}
          >
            Mark as Unpaid (Disputed)
          </Button>
        )}
      </ScrollView>

      {/* Fullscreen proof modal */}
      <Modal visible={proofFullscreen} transparent animationType="fade">
        <TouchableOpacity style={styles.fullscreenOverlay} onPress={() => setProofFullscreen(false)}>
          {proofUrl && (
            <Image source={{ uri: proofUrl }} style={styles.fullscreenImage} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 8,
    alignItems: 'flex-start',
  },
  monthTitle: { fontWeight: '700' },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  notesCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  proofSection: { gap: 8 },
  proofThumb: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    borderWidth: 1,
  },
  tapHint: { textAlign: 'center', marginTop: 4 },
  actionBtn: { marginTop: 4 },
  actionBtnContent: { paddingVertical: 6 },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImage: { width: '100%', height: '80%' },
});
