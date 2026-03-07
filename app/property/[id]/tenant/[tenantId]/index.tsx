import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Share, Alert, Modal, TouchableOpacity } from 'react-native';
import { Text, Chip, Button, IconButton, Divider, ActivityIndicator, Menu } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Tenant, Property, Payment } from '@/lib/types';
import { Colors } from '@/constants/colors';
import { formatCurrency, formatDate, getOrdinal } from '@/lib/utils';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PaymentLedger } from '@/components/PaymentLedger';
import { useAuthStore } from '@/lib/store';
import { usePayments } from '@/hooks/usePayments';
import { useProperties } from '@/hooks/useProperties';
import { sharePaymentReceipt, shareAnnualSummary } from '@/lib/pdf';
import { getInviteLink } from '@/lib/invite';

export default function TenantDetailScreen() {
  const { id: propertyId, tenantId } = useLocalSearchParams<{ id: string; tenantId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { ownedProperties } = useProperties();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [archiveDialogVisible, setArchiveDialogVisible] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState<string | null>(null);

  const { payments, isLoading: paymentsLoading, refresh: refreshPayments } = usePayments(tenant);
  const [property, setProperty] = useState<Property | null>(null);
  const [pdfMenuVisible, setPdfMenuVisible] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);

  const isOwner = ownedProperties.some((p) => p.id === propertyId);

  useEffect(() => {
    fetchTenant();
    fetchProperty();
  }, [tenantId]);

  async function fetchProperty() {
    if (!propertyId) return;
    const { data } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single<Property>();
    setProperty(data);
  }

  async function handleExportReceipt(payment: Payment) {
    if (!tenant || !property) return;
    setExportingPdf(true);
    try {
      await sharePaymentReceipt(payment, tenant, property, user?.full_name ?? 'Landlord');
    } catch (err) {
      Alert.alert('Export Failed', String(err));
    } finally {
      setExportingPdf(false);
    }
  }

  function handleExportAnnual() {
    setPdfMenuVisible(false);
    setYearPickerVisible(true);
  }

  async function handleExportAnnualForYear(selectedYear: number) {
    if (!tenant || !property) return;
    setYearPickerVisible(false);
    setExportingPdf(true);
    const yearPayments = payments.filter((p) => p.year === selectedYear);
    if (yearPayments.length === 0) {
      Alert.alert('No Data', `No payments found for ${selectedYear}.`);
      setExportingPdf(false);
      return;
    }
    try {
      await shareAnnualSummary(yearPayments, tenant, property, selectedYear);
    } catch (err) {
      Alert.alert('Export Failed', String(err));
    } finally {
      setExportingPdf(false);
    }
  }

  async function fetchTenant() {
    setLoading(true);
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single<Tenant>();
    setTenant(data);
    setLoading(false);
  }

  async function handleShareInvite() {
    if (!tenant) return;
    const inviteLink = getInviteLink(tenant.invite_token);
    await Share.share({
      message: `You've been added as a tenant on Dwella! Open this link to accept your invitation:\n\n${inviteLink}`,
      title: 'Tenant Invite',
    });
  }

  async function handleArchive() {
    if (!tenant) return;
    setArchiving(true);
    const { error } = await supabase
      .from('tenants')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('id', tenant.id);
    if (error) Alert.alert('Error', error.message);
    else router.back();
    setArchiving(false);
    setArchiveDialogVisible(false);
  }

  async function handleConfirmPayment(payment: Payment) {
    setConfirmingPayment(payment.id);
    const { error } = await supabase
      .from('payments')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        auto_confirmed: false,
      })
      .eq('id', payment.id);
    if (error) Alert.alert('Error', error.message);
    else refreshPayments();
    setConfirmingPayment(null);
  }

  function handleMarkPaid(payment: Payment) {
    router.push(`/property/${propertyId}/tenant/${tenantId}/payment/mark-paid?paymentId=${payment.id}`);
  }

  function handleViewPayment(payment: Payment) {
    router.push(`/property/${propertyId}/tenant/${tenantId}/payment/${payment.id}`);
  }

  const inviteStatusColor = {
    pending: Colors.statusPending,
    accepted: Colors.statusConfirmed,
    expired: Colors.statusOverdue,
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!tenant) {
    return <View style={styles.centered}><Text>Tenant not found.</Text></View>;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: tenant.tenant_name,
          headerTitleAlign: 'center',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.surface, height: 64 },
          headerTintColor: Colors.textPrimary,
          headerRight: () => (
            <View style={styles.headerActions}>
              <Menu
                visible={pdfMenuVisible}
                onDismiss={() => setPdfMenuVisible(false)}
                anchor={
                  <IconButton
                    icon="file-pdf-box"
                    size={22}
                    onPress={() => setPdfMenuVisible(true)}
                    disabled={exportingPdf}
                  />
                }
              >
                <Menu.Item
                  leadingIcon="calendar-month"
                  onPress={handleExportAnnual}
                  title="Annual Summary…"
                  disabled={payments.length === 0}
                />
              </Menu>
              {isOwner && (
                <>
                  <IconButton
                    icon="pencil"
                    size={22}
                    onPress={() => router.push(`/property/${propertyId}/tenant/${tenantId}/edit`)}
                  />
                  <IconButton
                    icon="delete"
                    size={22}
                    iconColor={Colors.error}
                    onPress={() => setArchiveDialogVisible(true)}
                  />
                </>
              )}
            </View>
          ),
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Info Card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text variant="bodySmall" style={styles.label}>Flat / Unit</Text>
            <Text variant="bodyLarge" style={styles.value}>{tenant.flat_no}</Text>
          </View>
          <Divider />
          <View style={styles.cardRow}>
            <Text variant="bodySmall" style={styles.label}>Monthly Rent</Text>
            <Text variant="bodyLarge" style={styles.value}>{formatCurrency(tenant.monthly_rent)}</Text>
          </View>
          <Divider />
          <View style={styles.cardRow}>
            <Text variant="bodySmall" style={styles.label}>Security Deposit</Text>
            <Text variant="bodyLarge" style={styles.value}>{formatCurrency(tenant.security_deposit)}</Text>
          </View>
          <Divider />
          <View style={styles.cardRow}>
            <Text variant="bodySmall" style={styles.label}>Due Day</Text>
            <Text variant="bodyLarge" style={styles.value}>{getOrdinal(tenant.due_day)} of month</Text>
          </View>
          <Divider />
          <View style={styles.cardRow}>
            <Text variant="bodySmall" style={styles.label}>Lease Start</Text>
            <Text variant="bodyLarge" style={styles.value}>{formatDate(tenant.lease_start)}</Text>
          </View>
          {tenant.lease_end && (
            <>
              <Divider />
              <View style={styles.cardRow}>
                <Text variant="bodySmall" style={styles.label}>Lease End</Text>
                <Text variant="bodyLarge" style={styles.value}>{formatDate(tenant.lease_end)}</Text>
              </View>
            </>
          )}
          <Divider />
          <View style={styles.cardRow}>
            <Text variant="bodySmall" style={styles.label}>Invite Status</Text>
            <Chip
              compact
              style={{ backgroundColor: inviteStatusColor[tenant.invite_status] + '22' }}
              textStyle={{ color: inviteStatusColor[tenant.invite_status] }}
            >
              {tenant.invite_status.charAt(0).toUpperCase() + tenant.invite_status.slice(1)}
            </Chip>
          </View>
        </View>

        {tenant.invite_status === 'pending' && (
          <Button mode="outlined" icon="share-variant" onPress={handleShareInvite} style={styles.shareButton}>
            Share Invite Link
          </Button>
        )}

        {/* Payment Ledger */}
        <Text variant="titleMedium" style={styles.sectionTitle}>Payment History</Text>
        <PaymentLedger
          payments={payments}
          isLoading={paymentsLoading}
          isOwner={isOwner}
          onPressRow={handleViewPayment}
          onMarkPaid={handleMarkPaid}
          onConfirm={handleConfirmPayment}
          onExportReceipt={handleExportReceipt}
        />
      </ScrollView>

      <ConfirmDialog
        visible={archiveDialogVisible}
        title="Remove Tenant"
        message={`Remove ${tenant.tenant_name} from this property? Their payment history will be preserved.`}
        confirmLabel="Remove"
        confirmColor={Colors.error}
        loading={archiving}
        onConfirm={handleArchive}
        onCancel={() => setArchiveDialogVisible(false)}
      />

      {/* Year Picker Modal */}
      <Modal
        visible={yearPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setYearPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setYearPickerVisible(false)}
        >
          <View style={styles.yearPickerSheet}>
            <Text variant="titleMedium" style={styles.yearPickerTitle}>Select Year</Text>
            {[...new Set(payments.map((p) => p.year))].sort((a, b) => b - a).map((y) => (
              <TouchableOpacity
                key={y}
                style={styles.yearOption}
                onPress={() => handleExportAnnualForYear(y)}
                activeOpacity={0.7}
              >
                <Text variant="bodyLarge" style={styles.yearOptionText}>{y}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelOption} onPress={() => setYearPickerVisible(false)}>
              <Text variant="bodyMedium" style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row' },
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
  shareButton: { borderColor: Colors.primary },
  sectionTitle: { fontWeight: '600', color: Colors.textPrimary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  yearPickerSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
    gap: 4,
  },
  yearPickerTitle: {
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  yearOption: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  yearOptionText: { color: Colors.primary, fontWeight: '600' },
  cancelOption: {
    paddingVertical: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: { color: Colors.textSecondary },
});
