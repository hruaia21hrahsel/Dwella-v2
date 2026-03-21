import { type ComponentProps } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MaintenanceRequest } from '@/lib/types';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_ICONS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from '@/lib/maintenance';
import { useTheme } from '@/lib/theme-context';

interface MaintenanceRequestCardProps {
  request: MaintenanceRequest;
  onPress: () => void;
}

function relativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function MaintenanceRequestCard({ request, onPress }: MaintenanceRequestCardProps) {
  const { colors } = useTheme();

  const statusColor = STATUS_COLORS[request.status];
  const statusIcon = STATUS_ICONS[request.status] as ComponentProps<typeof MaterialCommunityIcons>['name'];
  const priorityColor = PRIORITY_COLORS[request.priority];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {/* Status icon container */}
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: statusColor + '1F' },
        ]}
      >
        <MaterialCommunityIcons name={statusIcon} size={20} color={statusColor} />
      </View>

      {/* Text column */}
      <View style={styles.info}>
        <Text
          style={[styles.title, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {request.title}
        </Text>
        <Text
          style={[styles.description, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {request.description}
        </Text>

        {/* Status chip + priority + timestamp row */}
        <View style={styles.metaRow}>
          {/* Status chip */}
          <View
            style={[
              styles.statusChip,
              { backgroundColor: statusColor + '1F' },
            ]}
          >
            <Text style={[styles.statusChipText, { color: statusColor }]}>
              {STATUS_LABELS[request.status]}
            </Text>
          </View>

          {/* Priority dot + label */}
          <View style={styles.priorityRow}>
            <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
            <Text style={[styles.priorityLabel, { color: colors.textSecondary }]}>
              {PRIORITY_LABELS[request.priority]}
            </Text>
          </View>

          {/* Timestamp */}
          <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
            {relativeTime(request.created_at)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  info: {
    flex: 1,
    marginLeft: 12,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  },
  description: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  statusChip: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '400',
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityLabel: {
    fontSize: 13,
    fontWeight: '400',
  },
  timestamp: {
    fontSize: 13,
    fontWeight: '400',
    marginLeft: 'auto',
  },
});
