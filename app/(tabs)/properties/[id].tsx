import { useCallback } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
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
  const { colors } = useTheme();
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
  const propColorMid = propColor + '30';

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
          headerShown: true,
          title: property.name,
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.background } as object,
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
              <MaterialCommunityIcons name="chevron-left" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
      >
        {/* Address bar */}
        <View style={[styles.addressBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.propIcon, { backgroundColor: propColorSoft }]}>
            <MaterialCommunityIcons name="home-city" size={16} color={propColor} />
          </View>
          <Text style={[styles.addressText, { color: colors.textSecondary }]} numberOfLines={1}>
            {property.address}, {property.city}
          </Text>
        </View>

        {/* Combined metrics card */}
        <View style={[styles.metricsCard, { backgroundColor: propColorSoft, borderColor: propColorMid }]}>
          <View style={styles.revenueRow}>
            <View style={styles.revenueInfo}>
              <Text style={[styles.revenueLabel, { color: propColor }]}>Monthly Revenue</Text>
              <Text style={[styles.revenueValue, { color: propColor }]}>{formatCurrency(totalRent)}</Text>
            </View>
            <View style={[styles.revenueIcon, { backgroundColor: propColorMid }]}>
              <MaterialCommunityIcons name="trending-up" size={18} color={propColor} />
            </View>
          </View>
          <View style={[styles.metricsDivider, { backgroundColor: propColorMid }]} />
          <View style={styles.statsInline}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{property.total_units}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: propColorMid }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.statusConfirmed }]}>{occupiedCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Occupied</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: propColorMid }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: vacantCount > 0 ? colors.statusPartial : colors.textDisabled }]}>{vacantCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Vacant</Text>
            </View>
          </View>
        </View>

        {/* Tenants */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Tenants</Text>
              <View style={[styles.countBadge, { backgroundColor: propColorSoft }]}>
                <Text style={[styles.countBadgeText, { color: propColor }]}>{tenants.length}</Text>
              </View>
            </View>
            {isOwner && (
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: propColor }]}
                onPress={() => router.push(`/property/${id}/tenant/create`)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="plus" size={14} color="#fff" />
                <Text style={styles.addBtnText}>Add Tenant</Text>
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
          <View style={[styles.notesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.notesHeader}>
              <MaterialCommunityIcons name="note-text-outline" size={14} color={colors.textSecondary} />
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
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginLeft: -4,
  },

  addressBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  propIcon: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  addressText: { fontSize: 13, flex: 1 },

  // Combined metrics card
  metricsCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  revenueRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14,
  },
  revenueInfo: { gap: 2 },
  revenueLabel: {
    fontSize: 10, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.75,
  },
  revenueValue: { fontSize: 22, fontWeight: '800' },
  revenueIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  metricsDivider: { height: 1, marginHorizontal: 14 },
  statsInline: {
    flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 14,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 17, fontWeight: '800' },
  statLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
  statDivider: { width: 1, marginVertical: 4 },

  // Section
  section: { gap: 8 },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  countBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  countBadgeText: { fontSize: 11, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7,
  },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Notes
  notesCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  notesLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  notesText: { fontSize: 13, lineHeight: 19 },
});
