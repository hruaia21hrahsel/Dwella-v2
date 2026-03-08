import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useProperties } from '@/hooks/useProperties';
import { PropertyCard, TenantSummary } from '@/components/PropertyCard';
import { EmptyState } from '@/components/EmptyState';
import { ListSkeleton } from '@/components/ListSkeleton';
import { ErrorBanner } from '@/components/ErrorBanner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AnimatedCard } from '@/components/AnimatedCard';
import { Colors, Shadows } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Property } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

export default function PropertiesScreen() {
  const router = useRouter();
  const { bumpPropertyRefresh } = useAuthStore();
  const { ownedProperties, tenantProperties, isLoading, error, refresh } = useProperties();
  const [archiveTarget, setArchiveTarget] = useState<Property | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Tenants grouped by property
  const [tenantsByProperty, setTenantsByProperty] = useState<Record<string, TenantSummary[]>>({});

  const fetchTenants = useCallback(async () => {
    if (ownedProperties.length === 0) return;
    const { data } = await supabase
      .from('tenants')
      .select('id, tenant_name, flat_no, monthly_rent, invite_status, property_id')
      .in('property_id', ownedProperties.map((p) => p.id))
      .eq('is_archived', false)
      .order('tenant_name');

    const grouped: Record<string, TenantSummary[]> = {};
    for (const t of data ?? []) {
      if (!grouped[t.property_id]) grouped[t.property_id] = [];
      grouped[t.property_id].push({
        id: t.id,
        tenant_name: t.tenant_name,
        flat_no: t.flat_no,
        monthly_rent: t.monthly_rent,
        invite_status: t.invite_status as 'pending' | 'accepted',
      });
    }
    // Ensure empty arrays for properties with no tenants
    for (const p of ownedProperties) {
      if (!grouped[p.id]) grouped[p.id] = [];
    }
    setTenantsByProperty(grouped);
  }, [ownedProperties]);

  useFocusEffect(
    useCallback(() => {
      fetchTenants();
    }, [fetchTenants])
  );

  const handleAddProperty = useCallback(() => {
    router.push('/property/create');
  }, [router]);

  async function handleArchiveProperty() {
    if (!archiveTarget) return;
    setDeleting(true);

    await supabase
      .from('tenants')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('property_id', archiveTarget.id);

    await supabase
      .from('properties')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('id', archiveTarget.id);

    setDeleting(false);
    setArchiveTarget(null);
    bumpPropertyRefresh();
  }

  // Portfolio summary
  const totalUnits = ownedProperties.reduce((sum, p) => sum + p.total_units, 0);
  const totalTenants = Object.values(tenantsByProperty).reduce((sum, ts) => sum + ts.length, 0);
  const totalRent = Object.values(tenantsByProperty)
    .flat()
    .reduce((sum, t) => sum + t.monthly_rent, 0);

  if (isLoading) {
    return <ListSkeleton count={3} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => { refresh(); fetchTenants(); }} />
        }
      >
        <ErrorBanner error={error} onRetry={refresh} />

        {/* Portfolio summary — only when there are properties */}
        {ownedProperties.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <MaterialCommunityIcons name="chart-box-outline" size={16} color={Colors.primaryDark} />
              <Text style={styles.summaryTitle}>Portfolio Overview</Text>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{ownedProperties.length}</Text>
                <Text style={styles.summaryLabel}>{ownedProperties.length === 1 ? 'Property' : 'Properties'}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{totalTenants}<Text style={styles.summarySmall}>/{totalUnits}</Text></Text>
                <Text style={styles.summaryLabel}>Occupied</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{formatCurrency(totalRent)}</Text>
                <Text style={styles.summaryLabel}>Rent/mo</Text>
              </View>
            </View>
          </View>
        )}

        {/* My Properties Section */}
        <View style={styles.sectionDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.sectionHeaderText}>My Properties</Text>
          <View style={styles.dividerLine} />
        </View>

        {ownedProperties.length === 0 ? (
          <EmptyState
            icon="home-plus"
            title="No properties yet"
            subtitle="Tap the + button to add your first property"
          />
        ) : (
          ownedProperties.map((property, index) => (
            <AnimatedCard key={property.id} index={index}>
              <PropertyCard
                property={property}
                tenants={tenantsByProperty[property.id]}
                onPress={() => router.push(`/(tabs)/properties/${property.id}`)}
                onEdit={() => router.push({ pathname: '/property/create', params: { id: property.id } })}
                onDelete={() => setArchiveTarget(property)}
                onTenantPress={(tenantId) => router.push(`/property/${property.id}/tenant/${tenantId}`)}
              />
            </AnimatedCard>
          ))
        )}

        {/* Tenant Section */}
        {tenantProperties.length > 0 && (
          <>
            <View style={[styles.sectionDivider, { marginTop: 20 }]}>
              <View style={styles.dividerLine} />
              <Text style={styles.sectionHeaderText}>I'm a Tenant At</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.tenantSection}>
              {tenantProperties.map((tenant) => (
                tenant.properties && (
                  <PropertyCard
                    key={tenant.id}
                    property={tenant.properties}
                    isTenantView
                    onPress={() => router.push(`/(tabs)/properties/${tenant.properties!.id}`)}
                  />
                )
              ))}
            </View>
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddProperty}
        color={Colors.textOnPrimary}
      />

      <ConfirmDialog
        visible={!!archiveTarget}
        title="Archive Property"
        message={`Archive "${archiveTarget?.name}"? This will also archive all its tenants. This cannot be undone.`}
        confirmLabel="Archive"
        confirmColor={Colors.error}
        loading={deleting}
        onConfirm={handleArchiveProperty}
        onCancel={() => setArchiveTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 80,
  },

  // Portfolio summary
  summaryCard: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.primaryLight,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  summarySmall: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryMid,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
    opacity: 0.7,
  },

  // Section divider
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  sectionHeaderText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tenantSection: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 16,
    padding: 14,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    ...Shadows.md,
  },
});
