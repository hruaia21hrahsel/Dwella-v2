import { type ComponentProps } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MaintenanceStatusLog } from '@/lib/types';
import {
  STATUS_ICONS,
  STATUS_COLORS,
  STATUS_LABELS,
} from '@/lib/maintenance';
import { useTheme } from '@/lib/theme-context';

interface MaintenanceTimelineProps {
  logs: MaintenanceStatusLog[];
  userNames: Record<string, string>;
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

export function MaintenanceTimeline({ logs, userNames }: MaintenanceTimelineProps) {
  const { colors } = useTheme();

  if (logs.length === 0) {
    return (
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        No activity yet.
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      {logs.map((log, index) => {
        const isLast = index === logs.length - 1;
        const statusColor = STATUS_COLORS[log.to_status];
        const statusIcon = STATUS_ICONS[log.to_status] as ComponentProps<typeof MaterialCommunityIcons>['name'];
        const actorName = userNames[log.changed_by] ?? 'Unknown';
        const actionText =
          log.from_status === null
            ? 'submitted this request'
            : `changed status to ${STATUS_LABELS[log.to_status]}`;

        return (
          <View key={log.id} style={styles.entry}>
            {/* Left column: icon + connector line */}
            <View style={styles.leftColumn}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: statusColor + '1F' },
                ]}
              >
                <MaterialCommunityIcons name={statusIcon} size={20} color={statusColor} />
              </View>
              {!isLast && (
                <View style={[styles.connector, { backgroundColor: colors.divider }]} />
              )}
            </View>

            {/* Right column: content */}
            <View style={styles.content}>
              <View style={styles.headerRow}>
                <Text style={[styles.actorName, { color: colors.textPrimary }]}>
                  {actorName}
                </Text>
                <Text style={[styles.actionText, { color: colors.textPrimary }]}>
                  {' '}{actionText}
                </Text>
              </View>
              <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                {relativeTime(log.created_at)}
              </Text>
              {log.note ? (
                <Text style={[styles.note, { color: colors.textSecondary }]}>
                  {log.note}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    paddingVertical: 16,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  leftColumn: {
    alignItems: 'center',
    width: 36,
    marginRight: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 16,
    marginTop: 4,
    marginBottom: 4,
  },
  content: {
    flex: 1,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  actorName: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 2,
  },
  note: {
    fontSize: 14,
    fontWeight: '400',
    fontStyle: 'italic',
    lineHeight: 20,
    marginTop: 4,
  },
});
