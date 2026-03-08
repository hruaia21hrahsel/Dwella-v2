import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Shadows } from '@/constants/colors';
import { useAuthStore } from '@/lib/store';
import { useNotifications } from '@/hooks/useNotifications';
import { Notification } from '@/lib/types';

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
    case 'reminder_upcoming': return 'clock-outline';
    case 'reminder_due':      return 'alert-circle-outline';
    case 'reminder_overdue':  return 'alert-outline';
    case 'payment_confirmed': return 'check-circle-outline';
    case 'payment_received':  return 'cash-check';
    default:                  return 'bell-outline';
  }
}

function iconColorForType(type: string): string {
  switch (type) {
    case 'reminder_overdue': return Colors.error;
    case 'reminder_due':     return Colors.warning;
    case 'payment_confirmed':
    case 'payment_received': return Colors.success;
    default:                 return Colors.primary;
  }
}

interface NotifRowProps {
  notif: Notification;
  onPress: () => void;
}

function NotifRow({ notif, onPress }: NotifRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.row, !notif.is_read && styles.rowUnread]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconColorForType(notif.type) + '18' }]}>
        <MaterialCommunityIcons
          name={iconForType(notif.type)}
          size={22}
          color={iconColorForType(notif.type)}
        />
      </View>
      <View style={styles.rowContent}>
        <Text
          style={[styles.rowTitle, !notif.is_read && styles.rowTitleUnread]}
          numberOfLines={1}
        >
          {notif.title}
        </Text>
        <Text style={styles.rowBody} numberOfLines={2}>{notif.body}</Text>
        <Text style={styles.rowTime}>{relativeTime(notif.created_at)}</Text>
      </View>
      {!notif.is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const { user } = useAuthStore();
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications(user?.id);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  async function handlePress(notif: Notification) {
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
          headerStyle: { backgroundColor: Colors.surface },
          headerTitleStyle: { color: Colors.textPrimary, fontWeight: '700' },
          headerRight: () =>
            unreadCount > 0 ? (
              <Button
                compact
                mode="text"
                onPress={markAllRead}
                textColor={Colors.primary}
                style={{ marginRight: 8 }}
              >
                Mark all read
              </Button>
            ) : null,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
      >
        {!loading && notifications.length === 0 && (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="bell-off-outline" size={48} color={Colors.textDisabled} />
            <Text style={styles.emptyText}>No notifications yet</Text>
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
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    ...Shadows.sm,
  },
  rowUnread: {
    backgroundColor: Colors.primarySoft,
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
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  rowTitleUnread: {
    fontWeight: '700',
  },
  rowBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  rowTime: {
    fontSize: 11,
    color: Colors.textDisabled,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
});
