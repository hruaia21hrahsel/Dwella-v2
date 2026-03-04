import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { Text, IconButton, ActivityIndicator, Chip } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useProperties } from '@/hooks/useProperties';
import { useTenants } from '@/hooks/useTenants';
import { TenantCard } from '@/components/TenantCard';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { ownedProperties, refresh: refreshProps } = useProperties();
  const { tenants, isLoading, refresh: refreshTenants } = useTenants(id);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const property = ownedProperties.find((p) => p.id === id);
  const isOwner = property?.owner_id === user?.id;

  const occupiedCount = tenants.filter((t) => t.invite_status === 'accepted').length;

  function handleRefresh() {
    refreshProps();
    refreshTenants();
  }

  async function handleArchiveProperty() {
    if (!id) return;
    setDeleting(true);

    // Archive all tenants first
    await supabase
      .from('tenants')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('property_id', id);

    // Archive property
    await supabase
      .from('properties')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('id', id);

    setDeleting(false);
    setDeleteDialogVisible(false);
    router.back();
  }

  if (isLoading && !property) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={styles.centered}>
        <Text>Property not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: property.name,
          headerRight: isOwner
            ? () => (
                <View style={styles.headerActions}>
                  <IconButton
                    icon="pencil"
                    size={22}
                    onPress={() => router.push({ pathname: '/property/create', params: { id } })}
                  />
                  <IconButton
                    icon="delete"
                    size={22}
                    iconColor={Colors.error}
                    onPress={() => setDeleteDialogVisible(true)}
                  />
                </View>
              )
            : undefined,
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
      >
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text variant="headlineSmall" style={styles.statValue}>{property.total_units}</Text>
            <Text variant="bodySmall" style={styles.statLabel}>Total Units</Text>
          </View>
          <View style={styles.statCard}>
            <Text variant="headlineSmall" style={styles.statValue}>{occupiedCount}</Text>
            <Text variant="bodySmall" style={styles.statLabel}>Occupied</Text>
          </View>
          <View style={styles.statCard}>
            <Text variant="headlineSmall" style={styles.statValue}>
              {tenants.length > 0
                ? formatCurrency(tenants.reduce((sum, t) => sum + t.monthly_rent, 0))
                : '₹0'}
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>Monthly Rent</Text>
          </View>
        </View>

        {/* Address */}
        <View style={styles.addressCard}>
          <Text variant="bodyMedium" style={styles.addressText}>{property.address}</Text>
          <Chip compact style={styles.cityChip}>{property.city}</Chip>
        </View>

        {/* Tenants */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Tenants</Text>
            {isOwner && (
              <IconButton
                icon="account-plus"
                size={22}
                iconColor={Colors.primary}
                onPress={() => router.push(`/property/${id}/tenant/create`)}
              />
            )}
          </View>

          {tenants.length === 0 ? (
            <EmptyState
              icon="account-plus"
              title="No tenants yet"
              subtitle={isOwner ? "Tap + to add a tenant and send them an invite" : "No tenants in this property"}
              actionLabel={isOwner ? "Add Tenant" : undefined}
              onAction={isOwner ? () => router.push(`/property/${id}/tenant/create`) : undefined}
            />
          ) : (
            tenants.map((tenant) => (
              <TenantCard
                key={tenant.id}
                tenant={tenant}
                onPress={() => router.push(`/property/${id}/tenant/${tenant.id}`)}
              />
            ))
          )}
        </View>

        {property.notes ? (
          <View style={styles.notesCard}>
            <Text variant="labelMedium" style={styles.notesLabel}>Notes</Text>
            <Text variant="bodyMedium">{property.notes}</Text>
          </View>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        visible={deleteDialogVisible}
        title="Archive Property"
        message={`Archive "${property.name}"? This will also archive all its tenants. This cannot be undone.`}
        confirmLabel="Archive"
        confirmColor={Colors.error}
        loading={deleting}
        onConfirm={handleArchiveProperty}
        onCancel={() => setDeleteDialogVisible(false)}
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
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    color: Colors.primary,
    fontWeight: '700',
  },
  statLabel: {
    color: Colors.textSecondary,
    marginTop: 4,
  },
  addressCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  addressText: {
    color: Colors.textSecondary,
  },
  cityChip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight + '22',
  },
  section: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  notesCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  notesLabel: {
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
});
