import { useCallback } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { useProperties } from '@/hooks/useProperties';
import { useTenants } from '@/hooks/useTenants';

import { TenantCard } from '@/components/TenantCard';
import { EmptyState } from '@/components/EmptyState';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { ownedProperties, refresh: refreshProps } = useProperties();
  const { tenants, isLoading, refresh: refreshTenants } = useTenants(id);

  const property = ownedProperties.find((p) => p.id === id);
  const isOwner = property?.owner_id === user?.id;

  const occupiedCount = tenants.filter((t) => t.invite_status === 'accepted').length;

  // Re-fetch tenants when screen regains focus
  useFocusEffect(
    useCallback(() => {
      refreshTenants();
    }, [refreshTenants])
  );

  function handleRefresh() {
    refreshProps();
    refreshTenants();
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
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.surface, height: 64 } as any,
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
      >
        {/* Stats + Address row */}
        <View style={styles.infoCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{property.total_units}</Text>
              <Text style={styles.statLabel}>Units</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{occupiedCount}</Text>
              <Text style={styles.statLabel}>Occupied</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { fontSize: 15 }]}>
                {tenants.length > 0
                  ? formatCurrency(tenants.reduce((sum, t) => sum + t.monthly_rent, 0))
                  : '₹0'}
              </Text>
              <Text style={styles.statLabel}>Rent/mo</Text>
            </View>
          </View>
          <View style={styles.addressRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.addressText} numberOfLines={1}>{property.address}, {property.city}</Text>
          </View>
        </View>

        {/* Tenants */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Tenants</Text>
            {isOwner && (
              <TouchableOpacity
                style={styles.addTenantBtn}
                onPress={() => router.push(`/property/${id}/tenant/create`)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="account-plus-outline" size={16} color="#fff" />
                <Text style={styles.addTenantBtnText}>Add Tenant</Text>
              </TouchableOpacity>
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
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
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
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addTenantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addTenantBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  notesCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  notesLabel: {
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
});
