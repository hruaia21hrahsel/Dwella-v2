import { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Text, TextInput, ActivityIndicator, Button } from 'react-native-paper';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useToastStore } from '@/lib/toast';
import { GlassCard } from '@/components/GlassCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MaintenanceTimeline } from '@/components/MaintenanceTimeline';
import { useTheme } from '@/lib/theme-context';
import {
  NEXT_STATUS,
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_ICONS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  getExpenseDescription,
} from '@/lib/maintenance';
import type { MaintenanceRequest, MaintenanceStatusLog, MaintenanceStatus } from '@/lib/types';
import { MAINTENANCE_PHOTOS_BUCKET } from '@/constants/config';

// ── Local helpers ─────────────────────────────────────────────────────────────

function relativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Action button labels — per UI-SPEC copywriting */
const ACTION_LABELS: Partial<Record<MaintenanceStatus, string>> = {
  open:         'Acknowledge Request',
  acknowledged: 'Start Work',
  in_progress:  'Mark Resolved',
  resolved:     'Close Request',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MaintenanceDetailScreen() {
  const { id: requestId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const showToast = useToastStore((s) => s.showToast);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [request, setRequest] = useState<MaintenanceRequest | null>(null);
  const [logs, setLogs] = useState<MaintenanceStatusLog[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [tenantName, setTenantName] = useState<string>('');
  const [isLandlord, setIsLandlord] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ── Action state ────────────────────────────────────────────────────────────
  const [isUpdating, setIsUpdating] = useState(false);
  const [note, setNote] = useState('');
  const [costAmount, setCostAmount] = useState('');
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // ── Photo viewer state ──────────────────────────────────────────────────────
  const [signedUrls, setSignedUrls] = useState<string[]>([]);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchRequest = useCallback(async () => {
    if (!requestId) return;
    const { data } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (data) setRequest(data as MaintenanceRequest);
  }, [requestId]);

  const fetchLogs = useCallback(async () => {
    if (!requestId) return;
    const { data } = await supabase
      .from('maintenance_status_logs')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });
    if (data) {
      setLogs(data as MaintenanceStatusLog[]);
      // Fetch names for all changed_by UUIDs
      const uniqueIds = [...new Set(data.map((l) => l.changed_by).filter(Boolean))];
      if (uniqueIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', uniqueIds);
        if (users) {
          const nameMap: Record<string, string> = {};
          for (const u of users) nameMap[u.id] = u.full_name ?? 'Unknown';
          setUserNames(nameMap);
        }
      }
    }
  }, [requestId]);

  const fetchMeta = useCallback(async (req: MaintenanceRequest) => {
    if (!user) return;

    // Tenant name
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('tenant_name')
      .eq('id', req.tenant_id)
      .single();
    if (tenantData) setTenantName(tenantData.tenant_name);

    // Landlord check
    const { data: propertyData } = await supabase
      .from('properties')
      .select('owner_id')
      .eq('id', req.property_id)
      .single();
    if (propertyData) setIsLandlord(propertyData.owner_id === user.id);

    // Signed URLs for photos
    if (req.photo_paths && req.photo_paths.length > 0) {
      const urls: string[] = [];
      for (const path of req.photo_paths) {
        const { data: urlData } = await supabase.storage
          .from(MAINTENANCE_PHOTOS_BUCKET)
          .createSignedUrl(path, 3600);
        if (urlData?.signedUrl) urls.push(urlData.signedUrl);
      }
      setSignedUrls(urls);
    }
  }, [user]);

  const loadAll = useCallback(async () => {
    if (!requestId) return;
    setIsLoading(true);
    try {
      const { data: req } = await supabase
        .from('maintenance_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      if (req) {
        setRequest(req as MaintenanceRequest);
        await Promise.all([fetchLogs(), fetchMeta(req as MaintenanceRequest)]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [requestId, fetchLogs, fetchMeta]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Realtime subscriptions ──────────────────────────────────────────────────

  useEffect(() => {
    if (!requestId) return;

    const requestChannel = supabase
      .channel(`maint-request-${requestId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'maintenance_requests',
        filter: `id=eq.${requestId}`,
      }, () => { fetchRequest(); })
      .subscribe();

    const logsChannel = supabase
      .channel(`maint-logs-${requestId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'maintenance_status_logs',
        filter: `request_id=eq.${requestId}`,
      }, () => { fetchLogs(); })
      .subscribe();

    return () => {
      supabase.removeChannel(requestChannel);
      supabase.removeChannel(logsChannel);
    };
  }, [requestId, fetchRequest, fetchLogs]);

  // ── Status change handler ───────────────────────────────────────────────────

  async function handleStatusChange() {
    if (!request || !user) return;
    const nextStatus = NEXT_STATUS[request.status];
    if (!nextStatus) return;

    setIsUpdating(true);
    try {
      // 1. Update request status
      const { error: updateError } = await supabase
        .from('maintenance_requests')
        .update({ status: nextStatus })
        .eq('id', requestId);
      if (updateError) throw updateError;

      // 2. Insert status log (MAINT-04)
      await supabase.from('maintenance_status_logs').insert({
        request_id: requestId,
        changed_by: user.id,
        from_status: request.status,
        to_status: nextStatus,
        note: note.trim() || null,
      });

      // 3. If resolving and cost entered, create expense (MAINT-06)
      if (nextStatus === 'resolved' && costAmount && parseFloat(costAmount) > 0) {
        await supabase.from('expenses').insert({
          property_id: request.property_id,
          user_id: user.id,
          amount: parseFloat(costAmount),
          category: 'maintenance',
          description: getExpenseDescription(request.title),
          expense_date: new Date().toISOString().split('T')[0],
          maintenance_request_id: request.id,
        });
      }

      // 4. Send push notification to tenant (MAINT-05)
      const { data: tenant } = await supabase
        .from('tenants')
        .select('user_id')
        .eq('id', request.tenant_id)
        .single();
      if (tenant?.user_id) {
        const { data: tenantUser } = await supabase
          .from('users')
          .select('push_token')
          .eq('id', tenant.user_id)
          .single();
        if (tenantUser?.push_token) {
          await supabase.functions.invoke('send-push', {
            body: {
              messages: [{
                token: tenantUser.push_token,
                title: 'Request Update',
                body: `Your maintenance request is now ${STATUS_LABELS[nextStatus]}.`,
                data: { type: 'maintenance_status_update', requestId },
              }],
            },
          });
        }

        // Insert in-app notification row for tenant (non-blocking)
        try {
          await supabase.from('notifications').insert({
            user_id: tenant.user_id,
            maintenance_request_id: requestId,
            type: 'maintenance_status_update',
            title: 'Request Update',
            body: `Your maintenance request is now ${STATUS_LABELS[nextStatus]}.`,
          });
        } catch (notifErr) {
          console.warn('[Dwella] Failed to insert maintenance_status_update notification row:', notifErr);
        }
      }

      // 5. Reset form and refresh
      setNote('');
      setCostAmount('');
      showToast(`Request ${STATUS_LABELS[nextStatus].toLowerCase()}`, 'success');
      fetchRequest();
      fetchLogs();
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message.includes('not allowed')
          ? 'This status change is not allowed.'
          : 'Could not update the request status. Please try again.';
      showToast(msg, 'error');
    } finally {
      setIsUpdating(false);
    }
  }

  function onPressAction() {
    if (!request) return;
    const nextStatus = NEXT_STATUS[request.status];
    if (nextStatus === 'closed') {
      setShowCloseConfirm(true);
    } else {
      handleStatusChange();
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading || !request) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const statusColor = STATUS_COLORS[request.status];
  const statusIcon = STATUS_ICONS[request.status] as React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  const priorityColor = PRIORITY_COLORS[request.priority];
  const priorityLabel = PRIORITY_LABELS[request.priority];
  const nextStatus = NEXT_STATUS[request.status];
  const actionLabel = nextStatus ? ACTION_LABELS[request.status] : null;
  const showCostField = nextStatus === 'resolved';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.divider, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {request.title}
        </Text>
        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
          <MaterialCommunityIcons name={statusIcon} size={14} color={statusColor} />
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
            {STATUS_LABELS[request.status]}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section 1 — Request Info */}
        <GlassCard style={styles.section}>
          <View style={styles.sectionPadding}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Details</Text>
            <Text style={[styles.description, { color: colors.textPrimary }]}>
              {request.description}
            </Text>

            <View style={styles.metaRow}>
              {/* Priority chip */}
              <View style={[styles.priorityChip, { backgroundColor: priorityColor + '22' }]}>
                <Text style={[styles.priorityChipText, { color: priorityColor }]}>
                  {priorityLabel}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="account-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                {tenantName || 'Tenant'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                {relativeTime(request.created_at)}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Section 2 — Photos (only if photos exist) */}
        {request.photo_paths && request.photo_paths.length > 0 && (
          <GlassCard style={styles.section}>
            <View style={styles.sectionPadding}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                {signedUrls.map((url, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      setSelectedPhotoUrl(url);
                      setPhotoViewerVisible(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: url }}
                      style={styles.thumbnail}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </GlassCard>
        )}

        {/* Section 3 — Activity Timeline */}
        <GlassCard style={styles.section}>
          <View style={styles.sectionPadding}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Activity</Text>
            <MaintenanceTimeline logs={logs} userNames={userNames} />
          </View>
        </GlassCard>

        {/* Section 4 — Landlord Action Area */}
        {isLandlord && request.status !== 'closed' && actionLabel && (
          <GlassCard style={styles.section}>
            <View style={styles.sectionPadding}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                Update Status
              </Text>

              {/* Optional note input */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Add a note (optional)
              </Text>
              <TextInput
                mode="outlined"
                placeholder="e.g. Plumber scheduled for Thursday"
                value={note}
                onChangeText={setNote}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                style={styles.noteInput}
              />

              {/* Cost field — only when resolving */}
              {showCostField && (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    Log repair cost?
                  </Text>
                  <TextInput
                    mode="outlined"
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    value={costAmount}
                    onChangeText={setCostAmount}
                    left={<TextInput.Affix text="£" />}
                    outlineColor={colors.border}
                    activeOutlineColor={colors.primary}
                    style={styles.costInput}
                  />
                </>
              )}

              {/* Primary action button */}
              <Button
                mode="contained"
                onPress={onPressAction}
                disabled={isUpdating}
                buttonColor={colors.primary}
                style={styles.actionButton}
                contentStyle={styles.actionButtonContent}
              >
                {isUpdating
                  ? <ActivityIndicator size="small" color="#fff" />
                  : actionLabel
                }
              </Button>
            </View>
          </GlassCard>
        )}
      </ScrollView>

      {/* Close Request Confirmation */}
      <ConfirmDialog
        visible={showCloseConfirm}
        title="Close this request?"
        message="Closing marks this request as resolved and complete. This cannot be undone."
        confirmLabel="Close Request"
        confirmColor={colors.error}
        loading={isUpdating}
        onConfirm={async () => {
          setShowCloseConfirm(false);
          await handleStatusChange();
        }}
        onCancel={() => setShowCloseConfirm(false)}
      />

      {/* Full-screen photo viewer */}
      <Modal
        visible={photoViewerVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setPhotoViewerVisible(false)}
      >
        <SafeAreaView style={[styles.photoViewer, { backgroundColor: '#000' }]}>
          <TouchableOpacity
            onPress={() => setPhotoViewerVisible(false)}
            style={styles.photoViewerClose}
          >
            <MaterialCommunityIcons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {selectedPhotoUrl && (
            <ScrollView
              maximumZoomScale={3}
              minimumZoomScale={1}
              contentContainerStyle={styles.photoViewerContent}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri: selectedPhotoUrl }}
                style={{ width: screenWidth, height: screenHeight - 100 }}
                resizeMode="contain"
              />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  section: {
    // GlassCard handles border + bg
  },
  sectionPadding: {
    padding: 16,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  description: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  priorityChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  priorityChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '400',
  },
  photoRow: {
    marginTop: 4,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
    marginTop: 8,
  },
  noteInput: {
    // paper TextInput handles sizing
  },
  costInput: {
    // paper TextInput handles sizing
  },
  actionButton: {
    marginTop: 12,
    borderRadius: 12,
  },
  actionButtonContent: {
    height: 48,
  },
  photoViewer: {
    flex: 1,
  },
  photoViewerClose: {
    position: 'absolute',
    top: 56,
    right: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoViewerContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
