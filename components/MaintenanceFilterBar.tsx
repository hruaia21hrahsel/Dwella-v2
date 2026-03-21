import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MaintenanceStatus, MaintenancePriority } from '@/lib/types';
import {
  ALL_STATUSES,
  ALL_PRIORITIES,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from '@/lib/maintenance';
import { useTheme } from '@/lib/theme-context';

interface MaintenanceFilterBarProps {
  selectedStatus: MaintenanceStatus | null;
  selectedPriority: MaintenancePriority | null;
  sortOrder: 'newest' | 'oldest';
  onStatusChange: (status: MaintenanceStatus | null) => void;
  onPriorityChange: (priority: MaintenancePriority | null) => void;
  onSortToggle: () => void;
}

export function MaintenanceFilterBar({
  selectedStatus,
  selectedPriority,
  sortOrder,
  onStatusChange,
  onPriorityChange,
  onSortToggle,
}: MaintenanceFilterBarProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {/* Row 1: Status chips + sort toggle */}
      <View style={styles.row}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
          style={styles.scrollFlex}
        >
          {/* "All" chip */}
          <TouchableOpacity
            onPress={() => onStatusChange(null)}
            activeOpacity={0.7}
            style={[
              styles.chip,
              selectedStatus === null
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: selectedStatus === null ? colors.textOnPrimary : colors.textSecondary },
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          {/* Status chips */}
          {ALL_STATUSES.map((status) => {
            const isActive = selectedStatus === status;
            return (
              <TouchableOpacity
                key={status}
                onPress={() => onStatusChange(status)}
                activeOpacity={0.7}
                style={[
                  styles.chip,
                  isActive
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: isActive ? colors.textOnPrimary : colors.textSecondary },
                  ]}
                >
                  {STATUS_LABELS[status]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sort toggle */}
        <TouchableOpacity
          onPress={onSortToggle}
          activeOpacity={0.7}
          accessibilityLabel={`Sort requests, currently ${sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}`}
          style={styles.sortButton}
        >
          <MaterialCommunityIcons
            name="sort-variant"
            size={22}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Row 2: Priority chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
      >
        {/* "All" chip */}
        <TouchableOpacity
          onPress={() => onPriorityChange(null)}
          activeOpacity={0.7}
          style={[
            styles.chip,
            selectedPriority === null
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.chipText,
              { color: selectedPriority === null ? colors.textOnPrimary : colors.textSecondary },
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {/* Priority chips */}
        {ALL_PRIORITIES.map((priority) => {
          const isActive = selectedPriority === priority;
          return (
            <TouchableOpacity
              key={priority}
              onPress={() => onPriorityChange(priority)}
              activeOpacity={0.7}
              style={[
                styles.chip,
                isActive
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isActive ? colors.textOnPrimary : colors.textSecondary },
                ]}
              >
                {PRIORITY_LABELS[priority]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollFlex: {
    flex: 1,
  },
  chipsContainer: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  chip: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '400',
  },
  sortButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
