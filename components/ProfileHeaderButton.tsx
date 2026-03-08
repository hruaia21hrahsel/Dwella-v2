import { TouchableOpacity, View, StyleSheet, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/lib/store';
import { useNotifications } from '@/hooks/useNotifications';

export function ProfileHeaderButton({ style }: { style?: ViewStyle }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { unreadCount } = useNotifications(user?.id);

  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/profile')}
      style={[styles.btn, style]}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name="account-circle-outline" size={26} color="#fff" />
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
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
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
