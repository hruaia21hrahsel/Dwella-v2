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

  const pillBg = dark ? colors.primarySoft : 'rgba(255,255,255,0.18)';
  const iconColor = dark ? colors.primary : '#fff';

  return (
    <TouchableOpacity
      onPress={() => router.push('/notifications')}
      style={styles.btn}
      activeOpacity={0.7}
    >
      <View style={[styles.pill, { backgroundColor: pillBg }]}>
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
});
