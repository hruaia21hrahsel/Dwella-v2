import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Share, Modal, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Tenant, Property, Payment } from '@/lib/types';
import { useTheme } from '@/lib/theme-context';
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
  const { colors } = useTheme();
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
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!tenant) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><Text>Tenant not found.</Text></View>;
  }

  const availableYears = [...new Set(payments.map((p) => p.year))].sort((a, b) => b - a);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerStyle: { backgroundColor: colors.background } as any,
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={8}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="chevron-left" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          ),
          headerRight: isOwner
            ? () => (
                <TouchableOpacity
                  style={styles.moreBtn}
                  onPress={() => setActionsVisible(true)}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="dots-vertical" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              )
            : undefined,
        }}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => { fetchTenant(); refreshPayments(); }}
          />
        }
      >
        {/* Unified info card */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Name + status */}
          <View style={styles.infoHeader}>
            {photoSignedUrl ? (
              <Image source={{ uri: photoSignedUrl }} style={[styles.avatar, { borderWidth: 2, borderColor: colors.primary }]} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: isPending ? colors.statusPartialSoft : colors.statusConfirmedSoft }]}>
                <MaterialCommunityIcons
                  name={isPending ? 'account-clock-outline' : 'account-check-outline'}
                  size={18}
                  color={isPending ? colors.statusPartial : colors.statusConfirmed}
                />
              </View>
            )}
            <Text style={[styles.tenantName, { color: colors.textPrimary }]} numberOfLines={1}>
              {tenant.tenant_name}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: isPending ? colors.statusPartialSoft : colors.statusConfirmedSoft }]}>
              <View style={[styles.statusDot, { backgroundColor: isPending ? colors.statusPartial : colors.statusConfirmed }]} />
              <Text style={[styles.statusText, { color: isPending ? colors.warning : colors.success }]}>
                {isPending ? 'Pending' : 'Active'}
              </Text>
            </View>
          </View>

          {/* Stats strip */}
          <View style={[styles.statsStrip, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatCurrency(tenant.monthly_rent)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>rent / mo</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{getOrdinal(tenant.due_day)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>due day</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatCurrency(tenant.security_deposit)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>deposit</Text>
            </View>
          </View>

          {/* Meta rows */}
          <View style={styles.metaRows}>
            <InfoRow label="Lease Start" value={formatDate(tenant.lease_start)} colors={colors} last={!tenant.lease_end} />
            {tenant.lease_end && (
              <InfoRow label="Lease End" value={formatDate(tenant.lease_end)} colors={colors} last />
            )}
          </View>

          {/* Notes (only if present) */}
          {tenant.notes ? (
            <View style={[styles.notesRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>Notes</Text>
              <Text style={[styles.notesText, { color: colors.textPrimary }]}>{tenant.notes}</Text>
            </View>
          ) : null}

          {/* Invite link — subtle inline row */}
          {isPending && (
            <TouchableOpacity
              style={[styles.inviteRow, { borderTopColor: colors.border }]}
              onPress={handleShareInvite}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="share-variant-outline" size={15} color={colors.primary} />
              <Text style={[styles.inviteText, { color: colors.primary }]}>Share Invite Link</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Payment History */}
        <View style={styles.paymentSection}>
          <View style={styles.paymentHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Payment History</Text>
            <View style={styles.paymentHeaderActions}>
              {isOwner && (
                <TouchableOpacity
                  style={[styles.actionChip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => router.push(`/log-payment?propertyId=${propertyId}&tenantId=${tenantId}`)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="plus" size={14} color={colors.primary} />
                  <Text style={[styles.actionChipText, { color: colors.primary }]}>Log</Text>
                </TouchableOpacity>
              )}
              {payments.length > 0 && (
                <TouchableOpacity
                  style={[styles.actionChip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => setYearPickerVisible(true)}
                  disabled={exportingPdf}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="file-pdf-box" size={14} color={colors.textSecondary} />
                  <Text style={[styles.actionChipText, { color: colors.textSecondary }]}>PDF</Text>
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
        confirmColor={colors.error}
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
          <View style={[styles.actionSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.actionOption}
              onPress={() => {
                setActionsVisible(false);
                router.push(`/property/${propertyId}/tenant/${tenantId}/edit`);
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.textPrimary} />
              <Text style={[styles.actionOptionText, { color: colors.textPrimary }]}>Edit Tenant</Text>
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
                <MaterialCommunityIcons name="file-pdf-box" size={20} color={colors.textPrimary} />
                <Text style={[styles.actionOptionText, { color: colors.textPrimary }]}>Export Annual PDF</Text>
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
                <MaterialCommunityIcons name="share-variant-outline" size={20} color={colors.textPrimary} />
                <Text style={[styles.actionOptionText, { color: colors.textPrimary }]}>Share Invite Link</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionOption, styles.actionOptionDanger, { borderTopColor: colors.border }]}
              onPress={() => {
                setActionsVisible(false);
                setArchiveDialogVisible(true);
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="archive-outline" size={20} color={colors.error} />
              <Text style={[styles.actionOptionText, { color: colors.error }]}>Remove Tenant</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionCancel, { borderTopColor: colors.border }]}
              onPress={() => setActionsVisible(false)}
            >
              <Text style={[styles.actionCancelText, { color: colors.textSecondary }]}>Cancel</Text>
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
          <View style={[styles.actionSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.yearPickerTitle, { color: colors.textPrimary }]}>Export Annual Summary</Text>
            {availableYears.map((y) => (
              <TouchableOpacity
                key={y}
                style={styles.yearOption}
                onPress={() => handleExportAnnualForYear(y)}
                activeOpacity={0.7}
              >
                <Text style={[styles.yearOptionText, { color: colors.primary }]}>{y}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.actionCancel, { borderTopColor: colors.border }]} onPress={() => setYearPickerVisible(false)}>
              <Text style={[styles.actionCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function InfoRow({ label, value, colors, last }: { label: string; value: string; colors: any; last?: boolean }) {
  return (
    <View style={[infoRowStyles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Text style={[infoRowStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[infoRowStyles.value, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const infoRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  label: { fontSize: 13 },
  value: { fontSize: 13, fontWeight: '600' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginLeft: -4,
  },
  moreBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // Unified info card
  infoCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },

  infoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  tenantName: { flex: 1, fontSize: 16, fontWeight: '700' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Stats strip
  statsStrip: {
    flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth },
  statValue: { fontSize: 15, fontWeight: '700' },
  statLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Meta rows (lease dates)
  metaRows: { paddingHorizontal: 14 },

  // Notes
  notesRow: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, gap: 4,
  },
  notesLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  notesText: { fontSize: 13, lineHeight: 19 },

  // Invite link row
  inviteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inviteText: { fontSize: 13, fontWeight: '600' },

  // Payment section
  paymentSection: { gap: 8 },
  paymentHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  paymentHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1,
  },
  actionChipText: { fontSize: 12, fontWeight: '600' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  actionSheet: {
    borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 36,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  actionOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 8, borderRadius: 10,
  },
  actionOptionDanger: {
    marginTop: 4, borderTopWidth: 1, borderRadius: 0, paddingTop: 18,
  },
  actionOptionText: { fontSize: 15, fontWeight: '500' },
  actionCancel: {
    paddingVertical: 14, marginTop: 8, borderTopWidth: 1, alignItems: 'center',
  },
  actionCancelText: { fontSize: 14 },
  yearPickerTitle: {
    fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 12,
  },
  yearOption: { paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  yearOptionText: { fontSize: 16, fontWeight: '600' },
});
