import { useCallback } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { Text, FAB, ActivityIndicator } from 'react-native-paper';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { useProperties } from '@/hooks/useProperties';
import { PropertyCard } from '@/components/PropertyCard';
import { EmptyState } from '@/components/EmptyState';
import { Colors } from '@/constants/colors';

export default function PropertiesScreen() {
  const router = useRouter();
  const { ownedProperties, tenantProperties, isLoading, refresh } = useProperties();

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleAddProperty = useCallback(() => {
    router.push('/property/create');
  }, [router]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Properties' }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refresh} />
          }
        >
          {/* My Properties Section */}
          <Text variant="titleMedium" style={styles.sectionHeader}>My Properties</Text>
          {ownedProperties.length === 0 ? (
            <EmptyState
              icon="home-plus"
              title="No properties yet"
              subtitle="Tap the + button to add your first property"
            />
          ) : (
            ownedProperties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onPress={() => router.push(`/(tabs)/properties/${property.id}`)}
              />
            ))
          )}

          {/* Tenant Section */}
          {tenantProperties.length > 0 && (
            <>
              <Text variant="titleMedium" style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
                I'm a Tenant At
              </Text>
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
    </>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  sectionHeader: {
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeaderSpaced: {
    marginTop: 24,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: Colors.primary,
  },
});
