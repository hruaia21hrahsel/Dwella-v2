import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/lib/store';
import { useNotifications } from '@/hooks/useNotifications';

export function NotificationsHeaderButton() {
  const { user } = useAuthStore();
  const { unreadCount } = useNotifications(user?.id);
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => router.push('/notifications')}
      style={styles.btn}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons
        name={unreadCount > 0 ? 'bell-badge' : 'bell-outline'}
        size={26}
        color={Colors.textPrimary}
      />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },
});
