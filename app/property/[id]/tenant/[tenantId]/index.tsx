import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Share, Modal, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Tenant, Property, Payment } from '@/lib/types';
import { Colors } from '@/constants/colors';
import { formatCurrency, formatDate, getOrdinal } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PaymentLedger } from '@/components/PaymentLedger';
import { useAuthStore } from '@/lib/store';
import { usePayments } from '@/hooks/usePayments';
import { useProperties } from '@/hooks/useProperties';
import { sharePaymentReceipt, shareAnnualSummary } from '@/lib/pdf';
import { getInviteLink } from '@/lib/invite';
import { useToastStore } from '@/lib/toast';

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
  const [exportingPdf, setExportingPdf] = useState(false);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);

  const [photoSignedUrl, setPhotoSignedUrl] = useState<string | null>(null);

  const isOwner = ownedProperties.some((p) => p.id === propertyId);
  const isPending = tenant?.invite_status === 'pending';

  useEffect(() => {
    fetchTenant();
    fetchProperty();
  }, [tenantId]);

  useFocusEffect(
    useCallback(() => {
      fetchTenant();
    }, [tenantId])
  );

  async function fetchProperty() {
    if (!propertyId) return;
    const { data } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single<Property>();
    setProperty(data);
  }

  async function fetchTenant() {
    setLoading(true);
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single<Tenant>();
    setTenant(data);
    if (data?.photo_url) {
      const { data: urlData } = await supabase.storage
        .from('tenant-photos')
        .createSignedUrl(data.photo_url, 3600);
      setPhotoSignedUrl(urlData?.signedUrl ?? null);
    } else {
      setPhotoSignedUrl(null);
    }
    setLoading(false);
  }

  async function handleExportReceipt(payment: Payment) {
    if (!tenant || !property) return;
    setExportingPdf(true);
    try {
      await sharePaymentReceipt(payment, tenant, property, user?.full_name ?? 'Landlord');
    } catch (err) {
      useToastStore.getState().showToast('Export failed: ' + String(err), 'error');
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleExportAnnualForYear(selectedYear: number) {
    if (!tenant || !property) return;
    setYearPickerVisible(false);
    setExportingPdf(true);
    const yearPayments = payments.filter((p) => p.year === selectedYear);
    if (yearPayments.length === 0) {
      useToastStore.getState().showToast(`No payments found for ${selectedYear}.`, 'info');
      setExportingPdf(false);
      return;
    }
    try {
      await shareAnnualSummary(yearPayments, tenant, property, selectedYear);
    } catch (err) {
      useToastStore.getState().showToast('Export failed: ' + String(err), 'error');
    } finally {
      setExportingPdf(false);
    }
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
    if (error) useToastStore.getState().showToast(error.message, 'error');
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
    if (error) useToastStore.getState().showToast(error.message, 'error');
    else refreshPayments();
    setConfirmingPayment(null);
  }

  function handleMarkPaid(payment: Payment) {
    router.push(`/property/${propertyId}/tenant/${tenantId}/payment/mark-paid?paymentId=${payment.id}`);
  }

  function handleViewPayment(payment: Payment) {
    router.push(`/property/${propertyId}/tenant/${tenantId}/payment/${payment.id}`);
  }

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

  const availableYears = [...new Set(payments.map((p) => p.year))].sort((a, b) => b - a);

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerBackTitle: 'Back',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.background } as any,
          headerTintColor: Colors.textPrimary,
          headerShadowVisible: false,
          headerRight: isOwner
            ? () => (
                <TouchableOpacity
                  style={styles.moreBtn}
                  onPress={() => setActionsVisible(true)}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="dots-vertical" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              )
            : undefined,
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => { fetchTenant(); refreshPayments(); }}
          />
        }
      >
        {/* Profile header */}
        <View style={styles.profileHeader}>
          {photoSignedUrl ? (
            <Image source={{ uri: photoSignedUrl }} style={styles.avatarPhoto} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: isPending ? Colors.statusPartialSoft : Colors.statusConfirmedSoft }]}>
              <MaterialCommunityIcons
                name={isPending ? 'account-clock-outline' : 'account-check-outline'}
                size={28}
                color={isPending ? Colors.statusPartial : Colors.statusConfirmed}
              />
            </View>
          )}
          <Text style={styles.tenantName}>{tenant.tenant_name}</Text>
          <View style={[styles.statusPill, { backgroundColor: isPending ? '#FEF3C7' : '#DCFCE7' }]}>
            <View style={[styles.statusDot, { backgroundColor: isPending ? Colors.statusPartial : Colors.statusConfirmed }]} />
            <Text style={[styles.statusText, { color: isPending ? '#92400E' : '#166534' }]}>
              {isPending ? 'Invite Pending' : 'Active Tenant'}
            </Text>
          </View>
          {property && (
            <Text style={styles.propertyLabel}>{property.name} · Flat {tenant.flat_no}</Text>
          )}
        </View>

        {/* Key stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="cash" size={18} color={Colors.primary} style={{ marginBottom: 4 }} />
            <Text style={styles.statValue}>{formatCurrency(tenant.monthly_rent)}</Text>
            <Text style={styles.statLabel}>Monthly Rent</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="calendar-clock" size={18} color={Colors.statusPartial} style={{ marginBottom: 4 }} />
            <Text style={styles.statValue}>{getOrdinal(tenant.due_day)}</Text>
            <Text style={styles.statLabel}>Due Day</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="shield-lock-outline" size={18} color={Colors.statusConfirmed} style={{ marginBottom: 4 }} />
            <Text style={styles.statValue}>{formatCurrency(tenant.security_deposit)}</Text>
            <Text style={styles.statLabel}>Deposit</Text>
          </View>
        </View>

        {/* Details card */}
        <View style={styles.detailCard}>
          <DetailRow icon="calendar-start" label="Lease Start" value={formatDate(tenant.lease_start)} />
          {tenant.lease_end && (
            <DetailRow icon="calendar-end" label="Lease End" value={formatDate(tenant.lease_end)} />
          )}
        </View>

        {/* Notes */}
        {tenant.notes ? (
          <View style={styles.notesCard}>
            <View style={styles.notesHeader}>
              <MaterialCommunityIcons name="note-text-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.notesLabel}>Notes</Text>
            </View>
            <Text style={styles.notesText}>{tenant.notes}</Text>
          </View>
        ) : null}

        {/* Invite action */}
        {isPending && (
          <TouchableOpacity style={styles.inviteBtn} onPress={handleShareInvite} activeOpacity={0.8}>
            <MaterialCommunityIcons name="share-variant-outline" size={18} color="#fff" />
            <Text style={styles.inviteBtnText}>Share Invite Link</Text>
          </TouchableOpacity>
        )}

        {/* Payment History */}
        <View style={styles.paymentSection}>
          <View style={styles.paymentHeader}>
            <Text style={styles.sectionTitle}>Payment History</Text>
            <View style={styles.paymentHeaderActions}>
              {isOwner && (
                <TouchableOpacity
                  style={styles.logPaymentBtn}
                  onPress={() => router.push(`/log-payment?propertyId=${propertyId}&tenantId=${tenantId}`)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="plus-circle-outline" size={16} color={Colors.primary} />
                  <Text style={styles.logPaymentBtnText}>Log Payment</Text>
                </TouchableOpacity>
              )}
              {payments.length > 0 && (
                <TouchableOpacity
                  style={styles.exportBtn}
                  onPress={() => setYearPickerVisible(true)}
                  disabled={exportingPdf}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="file-pdf-box" size={16} color={Colors.primary} />
                  <Text style={styles.exportBtnText}>Export</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <PaymentLedger
            payments={payments}
            isLoading={paymentsLoading}
            isOwner={isOwner}
            onPressRow={handleViewPayment}
            onMarkPaid={handleMarkPaid}
            onConfirm={handleConfirmPayment}
            onExportReceipt={handleExportReceipt}
            onLogPayment={(payment) => router.push(`/log-payment?propertyId=${propertyId}&tenantId=${tenantId}`)}
          />
        </View>

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

      {/* Actions bottom sheet */}
      <Modal
        visible={actionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActionsVisible(false)}
        >
          <View style={styles.actionSheet}>
            <View style={styles.sheetHandle} />
            <TouchableOpacity
              style={styles.actionOption}
              onPress={() => {
                setActionsVisible(false);
                router.push(`/property/${propertyId}/tenant/${tenantId}/edit`);
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="pencil-outline" size={20} color={Colors.textPrimary} />
              <Text style={styles.actionOptionText}>Edit Tenant</Text>
            </TouchableOpacity>
            {payments.length > 0 && (
              <TouchableOpacity
                style={styles.actionOption}
                onPress={() => {
                  setActionsVisible(false);
                  setYearPickerVisible(true);
                }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="file-pdf-box" size={20} color={Colors.textPrimary} />
                <Text style={styles.actionOptionText}>Export Annual PDF</Text>
              </TouchableOpacity>
            )}
            {isPending && (
              <TouchableOpacity
                style={styles.actionOption}
                onPress={() => {
                  setActionsVisible(false);
                  handleShareInvite();
                }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="share-variant-outline" size={20} color={Colors.textPrimary} />
                <Text style={styles.actionOptionText}>Share Invite Link</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionOption, styles.actionOptionDanger]}
              onPress={() => {
                setActionsVisible(false);
                setArchiveDialogVisible(true);
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="archive-outline" size={20} color={Colors.error} />
              <Text style={[styles.actionOptionText, { color: Colors.error }]}>Remove Tenant</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCancel}
              onPress={() => setActionsVisible(false)}
            >
              <Text style={styles.actionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
          <View style={styles.actionSheet}>
            <Text style={styles.yearPickerTitle}>Export Annual Summary</Text>
            {availableYears.map((y) => (
              <TouchableOpacity
                key={y}
                style={styles.yearOption}
                onPress={() => handleExportAnnualForYear(y)}
                activeOpacity={0.7}
              >
                <Text style={styles.yearOptionText}>{y}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.actionCancel} onPress={() => setYearPickerVisible(false)}>
              <Text style={styles.actionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <View style={detailStyles.left}>
        <MaterialCommunityIcons name={icon as any} size={16} color={Colors.textSecondary} />
        <Text style={detailStyles.label}>{label}</Text>
      </View>
      <Text style={detailStyles.value}>{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },

  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Profile header
  profileHeader: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarPhoto: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: 4,
  },
  tenantName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  propertyLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Detail card
  detailCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },

  // Notes card
  notesCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },

  // Invite button
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
  },
  inviteBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Payment section
  paymentSection: {
    gap: 10,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logPaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  logPaymentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  actionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  actionOptionDanger: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderRadius: 0,
    paddingTop: 18,
  },
  actionOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  actionCancel: {
    paddingVertical: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  actionCancelText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  yearPickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  yearOption: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  yearOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
});
