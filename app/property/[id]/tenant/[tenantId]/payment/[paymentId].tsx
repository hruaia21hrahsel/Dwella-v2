import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, Modal } from 'react-native';
import { Text, Button, Divider, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Payment, Tenant, Property } from '@/lib/types';
import { Colors } from '@/constants/colors';
import { sharePaymentReceipt } from '@/lib/pdf';
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
    if (error) Alert.alert('Error', error.message);
    else fetchPayment();
    setConfirming(false);
  }

  async function handleShareReceipt() {
    if (!payment || !tenant || !property) return;
    setSharing(true);
    try {
      await sharePaymentReceipt(payment, tenant, property, landlordName);
    } catch (err) {
      Alert.alert('Export Failed', String(err));
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
            if (error) Alert.alert('Error', error.message);
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
        <ActivityIndicator size="large" color={Colors.primary} />
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
          headerStyle: { backgroundColor: Colors.surface, height: 64 },
          headerTintColor: Colors.textPrimary,
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerCard}>
          <Text variant="headlineSmall" style={styles.monthTitle}>
            {getMonthName(payment.month)} {payment.year}
          </Text>
          <PaymentStatusBadge status={payment.status} compact={false} />
        </View>

        {/* Amounts */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text variant="bodySmall" style={styles.label}>Amount Due</Text>
            <Text variant="bodyLarge" style={styles.value}>{formatCurrency(payment.amount_due)}</Text>
          </View>
          <Divider />
          <View style={styles.cardRow}>
            <Text variant="bodySmall" style={styles.label}>Amount Paid</Text>
            <Text variant="bodyLarge" style={[styles.value, { color: Colors.statusConfirmed }]}>
              {formatCurrency(payment.amount_paid)}
            </Text>
          </View>
          {payment.amount_paid < payment.amount_due && (
            <>
              <Divider />
              <View style={styles.cardRow}>
                <Text variant="bodySmall" style={styles.label}>Balance</Text>
                <Text variant="bodyLarge" style={[styles.value, { color: Colors.statusOverdue }]}>
                  {formatCurrency(payment.amount_due - payment.amount_paid)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Timeline */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text variant="bodySmall" style={styles.label}>Due Date</Text>
            <Text variant="bodyMedium" style={styles.value}>{formatDate(payment.due_date)}</Text>
          </View>
          {payment.paid_at && (
            <>
              <Divider />
              <View style={styles.cardRow}>
                <Text variant="bodySmall" style={styles.label}>Marked Paid</Text>
                <Text variant="bodyMedium" style={styles.value}>{formatDate(payment.paid_at)}</Text>
              </View>
            </>
          )}
          {payment.confirmed_at && (
            <>
              <Divider />
              <View style={styles.cardRow}>
                <Text variant="bodySmall" style={styles.label}>
                  {payment.auto_confirmed ? 'Auto-confirmed' : 'Confirmed'}
                </Text>
                <Text variant="bodyMedium" style={styles.value}>{formatDate(payment.confirmed_at)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Notes */}
        {payment.notes ? (
          <View style={styles.notesCard}>
            <Text variant="labelMedium" style={styles.label}>Notes</Text>
            <Text variant="bodyMedium">{payment.notes}</Text>
          </View>
        ) : null}

        {/* Proof */}
        {proofUrl ? (
          <View style={styles.proofSection}>
            <Text variant="labelMedium" style={styles.label}>Payment Proof</Text>
            <TouchableOpacity onPress={() => setProofFullscreen(true)}>
              <Image source={{ uri: proofUrl }} style={styles.proofThumb} resizeMode="cover" />
              <Text variant="bodySmall" style={styles.tapHint}>Tap to view full screen</Text>
            </TouchableOpacity>
          </View>
        ) : null}

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
            buttonColor={Colors.statusConfirmed}
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
            textColor={Colors.error}
            style={[styles.actionBtn, styles.resetBtn]}
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
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    alignItems: 'flex-start',
  },
  monthTitle: { color: Colors.textPrimary, fontWeight: '700' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  label: { color: Colors.textSecondary },
  value: { color: Colors.textPrimary, fontWeight: '500' },
  notesCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  proofSection: { gap: 8 },
  proofThumb: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tapHint: { color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  actionBtn: { marginTop: 4 },
  actionBtnContent: { paddingVertical: 6 },
  resetBtn: { borderColor: Colors.error },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImage: { width: '100%', height: '80%' },
});
