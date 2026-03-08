import { useCallback } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { useProperties } from '@/hooks/useProperties';
import { useTenants } from '@/hooks/useTenants';

import { TenantCard } from '@/components/TenantCard';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Shadows } from '@/constants/colors';
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

  const occupiedCount = tenants.length;
  const totalRent = tenants.reduce((sum, t) => sum + t.monthly_rent, 0);
  const vacantCount = (property?.total_units ?? 0) - occupiedCount;

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
    return <View style={styles.centered}><Text>Property not found.</Text></View>;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: property.name,
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.surface, height: 64 } as any,
          headerTintColor: Colors.textPrimary,
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
      >
        {/* Property header */}
        <View style={styles.propertyHeader}>
          <View style={styles.propertyIconWrap}>
            <MaterialCommunityIcons name="home-city" size={28} color={Colors.primary} />
          </View>
          <Text style={styles.propertyName}>{property.name}</Text>
          <View style={styles.addressChip}>
            <MaterialCommunityIcons name="map-marker-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.addressText}>{property.address}, {property.city}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="door-open" size={18} color={Colors.primary} style={{ marginBottom: 4 }} />
            <Text style={styles.statValue}>{property.total_units}</Text>
            <Text style={styles.statLabel}>Total Units</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="account-group-outline" size={18} color={Colors.statusConfirmed} style={{ marginBottom: 4 }} />
            <Text style={styles.statValue}>{occupiedCount}</Text>
            <Text style={styles.statLabel}>Occupied</Text>
          </View>
          <View style={[styles.statCard, vacantCount > 0 && styles.statCardWarning]}>
            <MaterialCommunityIcons name="door-closed-lock" size={18} color={vacantCount > 0 ? Colors.statusPartial : Colors.textDisabled} style={{ marginBottom: 4 }} />
            <Text style={[styles.statValue, vacantCount > 0 && { color: Colors.statusPartial }]}>{vacantCount}</Text>
            <Text style={styles.statLabel}>Vacant</Text>
          </View>
        </View>

        {/* Revenue card */}
        <View style={styles.revenueCard}>
          <View style={styles.revenueLeft}>
            <Text style={styles.revenueLabel}>Monthly Revenue</Text>
            <Text style={styles.revenueValue}>{formatCurrency(totalRent)}</Text>
          </View>
          <View style={styles.revenueIconWrap}>
            <MaterialCommunityIcons name="trending-up" size={22} color={Colors.primaryDark} />
          </View>
        </View>

        {/* Tenants */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="account-multiple-outline" size={18} color={Colors.textPrimary} />
              <Text style={styles.sectionTitle}>Tenants</Text>
              <View style={styles.tenantCountBadge}>
                <Text style={styles.tenantCountText}>{tenants.length}</Text>
              </View>
            </View>
            {isOwner && (
              <TouchableOpacity
                style={styles.addTenantBtn}
                onPress={() => router.push(`/property/${id}/tenant/create`)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="account-plus-outline" size={15} color="#fff" />
                <Text style={styles.addTenantBtnText}>Add Tenant</Text>
              </TouchableOpacity>
            )}
          </View>

          {tenants.length === 0 ? (
            <EmptyState
              icon="account-plus"
              title="No tenants yet"
              subtitle={isOwner ? "Tap 'Add Tenant' to get started" : 'No tenants in this property'}
              actionLabel={isOwner ? 'Add Tenant' : undefined}
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

        {/* Notes */}
        {property.notes ? (
          <View style={styles.notesCard}>
            <View style={styles.notesHeader}>
              <MaterialCommunityIcons name="note-text-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.notesLabel}>Notes</Text>
            </View>
            <Text style={styles.notesText}>{property.notes}</Text>
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
    paddingBottom: 40,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },

  // Property header
  propertyHeader: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  propertyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  propertyName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  addressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addressText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // Stats row
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
  statCardWarning: {
    borderColor: Colors.statusPartialSoft,
    backgroundColor: '#FFFBEB',
  },
  statValue: {
    fontSize: 18,
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

  // Revenue card
  revenueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    padding: 16,
  },
  revenueLeft: {
    flex: 1,
    gap: 2,
  },
  revenueLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    opacity: 0.7,
  },
  revenueValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  revenueIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  tenantCountBadge: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tenantCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  addTenantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...Shadows.sm,
  },
  addTenantBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Notes card
  notesCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
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
});
