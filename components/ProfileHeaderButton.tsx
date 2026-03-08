import { TouchableOpacity, View, StyleSheet, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme-context';
import { useAuthStore } from '@/lib/store';
import { useNotifications } from '@/hooks/useNotifications';

interface Props {
  style?: ViewStyle;
  dark?: boolean;
}

export function ProfileHeaderButton({ style, dark = false }: Props) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { unreadCount } = useNotifications(user?.id);
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/profile')}
      style={[styles.btn, style]}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons
        name="account-circle-outline"
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
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});
