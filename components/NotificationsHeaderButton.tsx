import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme-context';
import { useAuthStore } from '@/lib/store';
import { useNotifications } from '@/hooks/useNotifications';

interface Props {
  dark?: boolean;
}

export function NotificationsHeaderButton({ dark = false }: Props) {
  const { user } = useAuthStore();
  const { unreadCount } = useNotifications(user?.id);
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={() => router.push('/notifications')}
      style={styles.btn}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons
        name={unreadCount > 0 ? 'bell-badge' : 'bell-outline'}
        size={26}
        color={dark ? colors.textPrimary : '#fff'}
      />
      {unreadCount > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.error }]}>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },
});
