import { useState, useEffect } from 'react';
import {
  View,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Text, FAB } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import { useProperties } from '@/hooks/useProperties';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';
import { ALL_STATUSES, STATUS_LABELS } from '@/lib/maintenance';
import { MaintenanceRequestCard } from '@/components/MaintenanceRequestCard';
import { MaintenanceFilterBar } from '@/components/MaintenanceFilterBar';
import { EmptyState } from '@/components/EmptyState';
import { ListSkeleton } from '@/components/ListSkeleton';
import type { MaintenanceStatus, MaintenancePriority, MaintenanceRequest } from '@/lib/types';

type SortOrder = 'newest' | 'oldest';

interface SectionData {
  title: string;
  status: MaintenanceStatus;
  data: MaintenanceRequest[];
}

export default function PropertyMaintenanceScreen() {
  const { id: propertyId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const { ownedProperties, tenantProperties } = useProperties();

  const [selectedStatus, setSelectedStatus] = useState<MaintenanceStatus | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<MaintenancePriority | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const { requests: rawRequests, isLoading, refresh } = useMaintenanceRequests(propertyId ?? null);

  // Determine user roles for this property
  const isOwner = ownedProperties.some((p) => p.id === propertyId);
  const [isTenant, setIsTenant] = useState(false);

  useEffect(() => {
    if (!user || !propertyId) return;
    supabase
      .from('tenants')
      .select('id')
      .eq('property_id', propertyId)
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .maybeSingle()
      .then(({ data }) => {
        setIsTenant(data != null);
      });
  }, [user, propertyId]);

  // Sort and filter
  const sorted = [...rawRequests].sort((a, b) => {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortOrder === 'newest' ? -diff : diff;
  });

  function buildSections(): SectionData[] {
    let filtered = sorted;

    if (selectedStatus) {
      filtered = filtered.filter((r) => r.status === selectedStatus);
    }
    if (selectedPriority) {
      filtered = filtered.filter((r) => r.priority === selectedPriority);
    }

    return ALL_STATUSES.reduce<SectionData[]>((acc, status) => {
      const sectionItems = filtered.filter((r) => r.status === status);
      if (sectionItems.length > 0 || selectedStatus === status) {
        acc.push({
          title: STATUS_LABELS[status].toUpperCase(),
          status,
          data: sectionItems,
        });
      }
      return acc;
    }, []);
  }

  const sections = buildSections();
  const hasNoRequests = !isLoading && rawRequests.length === 0;
  const hasNoFilteredResults =
    !isLoading &&
    rawRequests.length > 0 &&
    sections.every((s) => s.data.length === 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Maintenance',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.background } as object,
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={8}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="chevron-left" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Filter bar */}
      <View style={[styles.filterBarWrapper, { borderBottomColor: colors.border }]}>
        <MaintenanceFilterBar
          selectedStatus={selectedStatus}
          selectedPriority={selectedPriority}
          sortOrder={sortOrder}
          onStatusChange={setSelectedStatus}
          onPriorityChange={setSelectedPriority}
          onSortToggle={() => setSortOrder((s) => (s === 'newest' ? 'oldest' : 'newest'))}
        />
      </View>

      {/* Content */}
      {isLoading ? (
        <ListSkeleton count={4} rowHeight={88} />
      ) : hasNoRequests ? (
        isTenant ? (
          <EmptyState
            icon="wrench-outline"
            title="No maintenance requests"
            subtitle="Submit a request to let your landlord know about any issues in your home."
            actionLabel="Submit Request"
            onAction={() =>
              router.push((`/maintenance/submit?propertyId=${propertyId}`) as never)
            }
          />
        ) : (
          <EmptyState
            icon="wrench-outline"
            title="No maintenance requests"
            subtitle="You'll see requests here once your tenants submit them."
          />
        )
      ) : hasNoFilteredResults ? (
        <EmptyState
          icon="filter-outline"
          title="No matching requests"
          subtitle="Try adjusting your filters."
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refresh} />
          }
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <MaintenanceRequestCard
              request={item}
              onPress={() => router.push((`/maintenance/${item.id}`) as never)}
            />
          )}
        />
      )}

      {/* FAB: tenant only */}
      {isTenant && (
        <FAB
          icon="wrench-plus-outline"
          style={[styles.fab, { backgroundColor: colors.primary }]}
          color="#fff"
          label="New Request"
          onPress={() =>
            router.push((`/maintenance/submit?propertyId=${propertyId}`) as never)
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  filterBarWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  listContent: {
    padding: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
  },
});
