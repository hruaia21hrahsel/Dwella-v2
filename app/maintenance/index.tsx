import { useState, useEffect, useCallback } from 'react';
import {
  View,
  SectionList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Text, FAB } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useProperties } from '@/hooks/useProperties';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';
import { ALL_STATUSES, STATUS_LABELS } from '@/lib/maintenance';
import { MaintenanceRequestCard } from '@/components/MaintenanceRequestCard';
import { MaintenanceFilterBar } from '@/components/MaintenanceFilterBar';
import { EmptyState } from '@/components/EmptyState';
import { ListSkeleton } from '@/components/ListSkeleton';
import type { MaintenanceRequest, MaintenanceStatus, MaintenancePriority } from '@/lib/types';

type SortOrder = 'newest' | 'oldest';

interface SectionData {
  title: string;
  status: MaintenanceStatus;
  data: MaintenanceRequest[];
}

export default function MaintenanceIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const { ownedProperties, tenantProperties, isLoading: propertiesLoading } = useProperties();

  const allProperties = [
    ...ownedProperties,
    ...tenantProperties.map((tp) => tp.properties),
  ];

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<MaintenanceStatus | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<MaintenancePriority | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTenant, setIsTenant] = useState(false);

  // Set default selected property once properties load
  useEffect(() => {
    if (!selectedPropertyId && allProperties.length > 0) {
      setSelectedPropertyId(allProperties[0].id);
    }
  }, [allProperties.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine if current user has a tenant role in any property
  useEffect(() => {
    if (tenantProperties.length > 0) {
      setIsTenant(true);
    }
  }, [tenantProperties.length]);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('maintenance_requests')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: sortOrder === 'oldest' });

      if (selectedPropertyId) {
        query = query.eq('property_id', selectedPropertyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRequests((data as MaintenanceRequest[]) ?? []);
    } catch {
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPropertyId, sortOrder]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('maintenance-index-all')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maintenance_requests',
        },
        () => { fetchRequests(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchRequests]);

  // Filter and group requests into sections
  function buildSections(): SectionData[] {
    let filtered = requests;

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
  const hasNoRequests = !isLoading && requests.length === 0;
  const hasNoFilteredResults =
    !isLoading &&
    requests.length > 0 &&
    sections.every((s) => s.data.length === 0);

  const loading = propertiesLoading || isLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            height: 56 + insets.top,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Maintenance</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading && allProperties.length === 0 ? (
        <ListSkeleton count={3} rowHeight={88} />
      ) : (
        <>
          {/* Property picker */}
          {allProperties.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerContent}
              style={[styles.pickerRow, { borderBottomColor: colors.border }]}
            >
              {allProperties.map((p) => {
                const active = selectedPropertyId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setSelectedPropertyId(p.id)}
                    style={[
                      styles.pickerChip,
                      active
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.pickerChipText,
                        { color: active ? colors.textOnPrimary : colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

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
                  router.push(
                    selectedPropertyId
                      ? (`/maintenance/submit?propertyId=${selectedPropertyId}` as never)
                      : ('/maintenance/submit' as never),
                  )
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
                <RefreshControl refreshing={isLoading} onRefresh={fetchRequests} />
              }
              renderSectionHeader={({ section }) => (
                <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                  {section.title}
                </Text>
              )}
              renderItem={({ item }) => (
                <MaintenanceRequestCard
                  request={item}
                  onPress={() => router.push(`/maintenance/${item.id}` as never)}
                />
              )}
            />
          )}
        </>
      )}

      {/* FAB: tenant only */}
      {isTenant && (
        <FAB
          icon="wrench-plus-outline"
          style={[styles.fab, { backgroundColor: colors.primary }]}
          color="#fff"
          label="New Request"
          onPress={() =>
            router.push(
              selectedPropertyId
                ? (`/maintenance/submit?propertyId=${selectedPropertyId}` as never)
                : ('/maintenance/submit' as never),
            )
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  pickerRow: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  pickerContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  pickerChip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pickerChipText: {
    fontSize: 13,
    fontWeight: '500',
    maxWidth: 160,
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
