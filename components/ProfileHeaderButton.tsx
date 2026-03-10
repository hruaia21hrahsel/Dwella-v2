import { TouchableOpacity, View, Image, StyleSheet, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme-context';
import { useAuthStore } from '@/lib/store';

interface Props {
  style?: ViewStyle;
}

export function ProfileHeaderButton({ style }: Props) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : null;

  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/profile')}
      style={[styles.btn, style]}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
        {user?.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
        ) : initials ? (
          <Text style={[styles.initials, { color: colors.primary }]}>{initials}</Text>
        ) : (
          <MaterialCommunityIcons name="account-circle-outline" size={22} color={colors.primary} />
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
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  initials: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
});
