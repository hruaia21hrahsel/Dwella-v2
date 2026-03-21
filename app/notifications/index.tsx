import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme-context';
import { useAuthStore } from '@/lib/store';
import { useNotifications } from '@/hooks/useNotifications';
import { Notification } from '@/lib/types';
import { useTrack, EVENTS } from '@/lib/analytics';

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

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function iconForType(type: string): IconName {
  switch (type) {
    case 'reminder_upcoming':          return 'clock-outline';
    case 'reminder_due':               return 'alert-circle-outline';
    case 'reminder_overdue':           return 'alert-outline';
    case 'payment_confirmed':          return 'check-circle-outline';
    case 'payment_received':           return 'cash-check';
    case 'maintenance_new':            return 'wrench-outline';
    case 'maintenance_status_update':  return 'hammer-wrench';
    default:                           return 'bell-outline';
  }
}

function useIconColorForType(type: string): string {
  const { colors } = useTheme();
  switch (type) {
    case 'reminder_overdue':          return colors.error;
    case 'reminder_due':              return colors.warning;
    case 'payment_confirmed':
    case 'payment_received':          return colors.success;
    case 'maintenance_new':           return '#14B8A6'; // teal, matches tools card color
    case 'maintenance_status_update': return '#F59E0B'; // amber, matches in_progress status
    default:                          return colors.primary;
  }
}

interface NotifRowProps {
  notif: Notification;
  onPress: () => void;
}

function NotifRow({ notif, onPress }: NotifRowProps) {
  const { colors, shadows } = useTheme();
  const iconColor = useIconColorForType(notif.type);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.row,
        { backgroundColor: colors.surface, ...shadows.sm },
        !notif.is_read && { backgroundColor: colors.primarySoft },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconColor + '18' }]}>
        <MaterialCommunityIcons
          name={iconForType(notif.type)}
          size={22}
          color={iconColor}
        />
      </View>
      <View style={styles.rowContent}>
        <Text
          style={[styles.rowTitle, { color: colors.textPrimary }, !notif.is_read && styles.rowTitleUnread]}
          numberOfLines={1}
        >
          {notif.title}
        </Text>
        <Text style={[styles.rowBody, { color: colors.textSecondary }]} numberOfLines={2}>{notif.body}</Text>
        <Text style={[styles.rowTime, { color: colors.textDisabled }]}>{relativeTime(notif.created_at)}</Text>
      </View>
      {!notif.is_read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const { user } = useAuthStore();
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications(user?.id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const track = useTrack();

  async function handlePress(notif: Notification) {
    track(EVENTS.NOTIFICATION_TAPPED, { type: notif.type });
    if (!notif.is_read) await markRead(notif.id);
    // Navigate based on available context
    if (notif.payment_id && notif.tenant_id) {
      // We don't have property_id on the notification, so just go back
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          presentation: 'modal',
          title: 'Notifications',
          headerStyle: { backgroundColor: colors.background } as object,
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
      >
        {!loading && notifications.length === 0 && (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="bell-off-outline" size={48} color={colors.textDisabled} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No notifications yet</Text>
          </View>
        )}

        {notifications.map((notif) => (
          <NotifRow
            key={notif.id}
            notif={notif}
            onPress={() => handlePress(notif)}
          />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    gap: 8,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  rowTitleUnread: {
    fontWeight: '700',
  },
  rowBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowTime: {
    fontSize: 11,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
});
