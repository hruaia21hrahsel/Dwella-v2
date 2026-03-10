import { useState } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme-context';
import { useAuthStore } from '@/lib/store';
import { useNotifications } from '@/hooks/useNotifications';
import { Notification } from '@/lib/types';

const SCREEN_W = Dimensions.get('window').width;
const DROPDOWN_W = Math.min(320, SCREEN_W - 24);

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function iconForType(type: string): IconName {
  switch (type) {
    case 'reminder_upcoming': return 'clock-outline';
    case 'reminder_due':      return 'alert-circle-outline';
    case 'reminder_overdue':  return 'alert-outline';
    case 'payment_overdue':   return 'alert-outline';
    case 'payment_reminder':  return 'bell-ring-outline';
    case 'payment_confirmed': return 'check-circle-outline';
    case 'payment_received':  return 'cash-check';
    default:                  return 'bell-outline';
  }
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

export function NotificationsHeaderButton() {
  const { user } = useAuthStore();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(user?.id);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const iconColor = colors.primary;
  const headerHeight = 60 + insets.top;
  const dropdownTop = headerHeight + 6;

  function getIconColor(type: string): string {
    switch (type) {
      case 'reminder_overdue':
      case 'payment_overdue':  return colors.error;
      case 'reminder_due':     return colors.warning;
      case 'payment_confirmed':
      case 'payment_received': return colors.success;
      default:                 return colors.primary;
    }
  }

  async function handleNotifPress(notif: Notification) {
    if (!notif.is_read) await markRead(notif.id);
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={styles.btn}
        activeOpacity={0.7}
      >
        <View style={styles.pill}>
          <MaterialCommunityIcons
            name={unreadCount > 0 ? 'bell-badge' : 'bell-outline'}
            size={20}
            color={iconColor}
          />
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.error }]}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

        {/* Dropdown panel */}
        <View
          style={[
            styles.dropdown,
            {
              top: dropdownTop,
              right: 12,
              width: DROPDOWN_W,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: colors.textPrimary,
            },
          ]}
        >
          {/* Header row */}
          <View style={[styles.dropHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.dropTitle, { color: colors.textPrimary }]}>Notifications</Text>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
                <Text style={[styles.markAll, { color: colors.primary }]}>Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* List */}
          <ScrollView
            style={{ maxHeight: 380 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {notifications.length === 0 ? (
              <View style={styles.emptyWrap}>
                <MaterialCommunityIcons name="bell-off-outline" size={32} color={colors.textDisabled} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No notifications yet</Text>
              </View>
            ) : (
              notifications.map((notif, index) => {
                const iconColor = getIconColor(notif.type);
                const isLast = index === notifications.length - 1;
                return (
                  <TouchableOpacity
                    key={notif.id}
                    onPress={() => handleNotifPress(notif)}
                    activeOpacity={0.7}
                    style={[
                      styles.notifRow,
                      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                      !notif.is_read && { backgroundColor: colors.primarySoft },
                    ]}
                  >
                    {/* Unread accent */}
                    {!notif.is_read && (
                      <View style={[styles.unreadAccent, { backgroundColor: colors.primary }]} />
                    )}

                    {/* Icon */}
                    <View style={[styles.iconWrap, { backgroundColor: iconColor + '18' }]}>
                      <MaterialCommunityIcons name={iconForType(notif.type)} size={18} color={iconColor} />
                    </View>

                    {/* Content */}
                    <View style={styles.notifContent}>
                      <Text
                        style={[
                          styles.notifTitle,
                          { color: colors.textPrimary },
                          !notif.is_read && { fontWeight: '700' },
                        ]}
                        numberOfLines={1}
                      >
                        {notif.title}
                      </Text>
                      <Text style={[styles.notifBody, { color: colors.textSecondary }]} numberOfLines={2}>
                        {notif.body}
                      </Text>
                      <Text style={[styles.notifTime, { color: colors.textDisabled }]}>
                        {relativeTime(notif.created_at)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },

  // Modal
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  dropdown: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 10,
  },
  dropHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dropTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  markAll: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Notification row
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 10,
  },
  unreadAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifContent: {
    flex: 1,
    gap: 3,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  notifBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  notifTime: {
    fontSize: 10,
  },

  // Empty
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
  },
});
