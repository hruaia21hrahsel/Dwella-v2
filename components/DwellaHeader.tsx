import { ReactNode } from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme-context';
import { useAuthStore } from '@/lib/store';
import { ProfileHeaderButton } from '@/components/ProfileHeaderButton';
import { NotificationsHeaderButton } from '@/components/NotificationsHeaderButton';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

interface DwellaHeaderProps {
  style?: StyleProp<ViewStyle>;
  rightSlot?: ReactNode;
}

export function DwellaHeader({ style, rightSlot }: DwellaHeaderProps = {}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuthStore();

  const firstName = user?.full_name?.split(' ')[0] ?? 'there';

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top,
          height: 60 + insets.top,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
        style,
      ]}
    >
      <ProfileHeaderButton />
      <View style={styles.greeting}>
        <Text style={[styles.greetLine, { color: colors.textSecondary }]}>
          {getGreeting()},
        </Text>
        <Text style={[styles.nameLine, { color: colors.textPrimary }]} numberOfLines={1}>
          {firstName}
        </Text>
      </View>

      <View style={{ flex: 1 }} />
      {rightSlot}
      <NotificationsHeaderButton />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  greeting: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 1,
  },
  greetLine: {
    fontSize: 13,
    fontWeight: '400',
  },
  nameLine: {
    fontSize: 14,
    fontWeight: '700',
  },
});
