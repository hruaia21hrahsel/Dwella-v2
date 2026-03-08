import { useCallback } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { Text, FAB } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useProperties } from '@/hooks/useProperties';
import { PropertyCard } from '@/components/PropertyCard';
import { EmptyState } from '@/components/EmptyState';
import { ListSkeleton } from '@/components/ListSkeleton';
import { ErrorBanner } from '@/components/ErrorBanner';
import { AnimatedCard } from '@/components/AnimatedCard';
import { Colors } from '@/constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function PropertiesScreen() {
  const router = useRouter();
  const { ownedProperties, tenantProperties, isLoading, error, refresh } = useProperties();

  const handleAddProperty = useCallback(() => {
    router.push('/property/create');
  }, [router]);

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
    gap: 10,
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
