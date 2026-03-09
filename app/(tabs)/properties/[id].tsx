import { useCallback } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useProperties } from '@/hooks/useProperties';
import { useTenants } from '@/hooks/useTenants';

import { TenantCard } from '@/components/TenantCard';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/lib/theme-context';
import { useAuthStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, shadows, gradients } = useTheme();
  const { user } = useAuthStore();
  const { ownedProperties, refresh: refreshProps } = useProperties();
  const { tenants, isLoading, refresh: refreshTenants } = useTenants(id);

  const property = ownedProperties.find((p) => p.id === id);
  const isOwner = property?.owner_id === user?.id;

  const occupiedCount = tenants.length;
  const totalRent = tenants.reduce((sum, t) => sum + t.monthly_rent, 0);
  const vacantCount = (property?.total_units ?? 0) - occupiedCount;
  const propColor = property?.color ?? colors.primary;
  const propColorSoft = propColor + '18';
  const propColorLight = propColor + '30';

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
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!property) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><Text>Property not found.</Text></View>;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: property.name,
          headerTitleAlign: 'center',
          headerTintColor: colors.textPrimary,
          headerBackground: () => (
            <LinearGradient
              colors={[colors.surface, gradients.heroSubtle[1]]}
              start={{ x: 0.35, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          ),
        }}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
      >
        {/* Property header */}
        <View style={styles.propertyHeader}>
          <View style={[styles.propertyIconWrap, { backgroundColor: propColorSoft }]}>
            <MaterialCommunityIcons name="home-city" size={28} color={propColor} />
          </View>
          <Text style={[styles.propertyName, { color: colors.textPrimary }]}>{property.name}</Text>
          <View style={[styles.addressChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="map-marker-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.addressText, { color: colors.textSecondary }]}>{property.address}, {property.city}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="door-open" size={18} color={propColor} style={{ marginBottom: 4 }} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{property.total_units}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Units</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="account-group-outline" size={18} color={colors.statusConfirmed} style={{ marginBottom: 4 }} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{occupiedCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Occupied</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }, vacantCount > 0 && { borderColor: colors.statusPartialSoft, backgroundColor: colors.statusPartialSoft }]}>
            <MaterialCommunityIcons name="door-closed-lock" size={18} color={vacantCount > 0 ? colors.statusPartial : colors.textDisabled} style={{ marginBottom: 4 }} />
            <Text style={[styles.statValue, { color: colors.textPrimary }, vacantCount > 0 && { color: colors.statusPartial }]}>{vacantCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Vacant</Text>
          </View>
        </View>

        {/* Revenue card */}
        <View style={[styles.revenueCard, { backgroundColor: propColorSoft, borderColor: propColorLight }]}>
          <View style={styles.revenueLeft}>
            <Text style={[styles.revenueLabel, { color: propColor }]}>Monthly Revenue</Text>
            <Text style={[styles.revenueValue, { color: propColor }]}>{formatCurrency(totalRent)}</Text>
          </View>
          <View style={[styles.revenueIconWrap, { backgroundColor: propColorLight }]}>
            <MaterialCommunityIcons name="trending-up" size={22} color={propColor} />
          </View>
        </View>

        {/* Tenants */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="account-multiple-outline" size={18} color={colors.textPrimary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Tenants</Text>
              <View style={[styles.tenantCountBadge, { backgroundColor: propColorSoft }]}>
                <Text style={[styles.tenantCountText, { color: propColor }]}>{tenants.length}</Text>
              </View>
            </View>
          </View>

          {tenants.length === 0 ? (
            <EmptyState
              icon="account-plus"
              title="No tenants yet"
              subtitle={isOwner ? "Tap 'Add Tenant' to get started" : 'No tenants in this property'}
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
          <View style={[styles.notesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.notesHeader}>
              <MaterialCommunityIcons name="note-text-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>Notes</Text>
            </View>
            <Text style={[styles.notesText, { color: colors.textPrimary }]}>{property.notes}</Text>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  propertyName: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  addressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addressText: {
    fontSize: 12,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Revenue card
  revenueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  revenueLeft: {
    flex: 1,
    gap: 2,
  },
  revenueLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    opacity: 0.7,
  },
  revenueValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  revenueIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
  },
  tenantCountBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tenantCountText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Notes card
  notesCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
