import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { Text, FAB } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useProperties } from '@/hooks/useProperties';
import { PropertyCard } from '@/components/PropertyCard';
import { EmptyState } from '@/components/EmptyState';
import { ListSkeleton } from '@/components/ListSkeleton';
import { ErrorBanner } from '@/components/ErrorBanner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AnimatedCard } from '@/components/AnimatedCard';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Property } from '@/lib/types';

export default function PropertiesScreen() {
  const router = useRouter();
  const { bumpPropertyRefresh } = useAuthStore();
  const { ownedProperties, tenantProperties, isLoading, error, refresh } = useProperties();
  const [archiveTarget, setArchiveTarget] = useState<Property | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  if (isLoading) {
    return <ListSkeleton count={3} />;
  }

  return (
    <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refresh} />
          }
        >
          <ErrorBanner error={error} onRetry={refresh} />
          {/* My Properties Section */}
          <View style={styles.sectionDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.sectionHeader}>My Properties</Text>
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
                  onPress={() => router.push(`/(tabs)/properties/${property.id}`)}
                  onEdit={() => router.push({ pathname: '/property/create', params: { id: property.id } })}
                  onDelete={() => setArchiveTarget(property)}
                />
              </AnimatedCard>
            ))
          )}

          {/* Tenant Section */}
          {tenantProperties.length > 0 && (
            <>
              <View style={[styles.sectionDivider, { marginTop: 24 }]}>
                <View style={styles.dividerLine} />
                <Text style={styles.sectionHeader}>I'm a Tenant At</Text>
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
sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  sectionHeader: {
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
  },
});
