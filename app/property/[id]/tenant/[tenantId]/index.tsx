import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Share, Alert } from 'react-native';
import { Text, Chip, Button, IconButton, Divider, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Tenant } from '@/lib/types';
import { Colors } from '@/constants/colors';
import { formatCurrency, formatDate, getOrdinal } from '@/lib/utils';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function TenantDetailScreen() {
  const { id: propertyId, tenantId } = useLocalSearchParams<{ id: string; tenantId: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [archiveDialogVisible, setArchiveDialogVisible] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    fetchTenant();
  }, [tenantId]);

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
    const inviteLink = `dwella://invite/${tenant.invite_token}`;
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

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.back();
    }

    setArchiving(false);
    setArchiveDialogVisible(false);
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
    return (
      <View style={styles.centered}>
        <Text>Tenant not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: tenant.tenant_name,
          headerShown: true,
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.textPrimary,
          headerRight: () => (
            <View style={styles.headerActions}>
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

        {/* Share Invite (if pending) */}
        {tenant.invite_status === 'pending' && (
          <Button
            mode="outlined"
            icon="share-variant"
            onPress={handleShareInvite}
            style={styles.shareButton}
          >
            Share Invite Link
          </Button>
        )}

        {/* Payment Ledger — Phase B Placeholder */}
        <Text variant="titleMedium" style={styles.sectionTitle}>Payment History</Text>
        <EmptyState
          icon="receipt"
          title="No payments yet"
          subtitle="Payment tracking will be available in Phase B."
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
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
  },
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
  label: {
    color: Colors.textSecondary,
  },
  value: {
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  shareButton: {
    borderColor: Colors.primary,
  },
  sectionTitle: {
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
