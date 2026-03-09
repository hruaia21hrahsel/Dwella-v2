import { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme-context';
import { ProfileHeaderButton } from '@/components/ProfileHeaderButton';
import { DwellaHeaderTitle } from '@/components/DwellaHeaderTitle';
import { NotificationsHeaderButton } from '@/components/NotificationsHeaderButton';

interface Props {
  right?: ReactNode;
  showNotifications?: boolean;
}

export function DwellaHeader({ right, showNotifications = true }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const defaultRight = showNotifications
    ? <NotificationsHeaderButton dark />
    : <View style={{ width: 56 }} />;
  return (
    <View
      style={{
        backgroundColor: colors.background,
        paddingTop: insets.top,
        height: 56 + insets.top,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      }}
    >
      <ProfileHeaderButton dark />
      <View style={{ flex: 1, alignItems: 'center' }}>
        <DwellaHeaderTitle dark />
      </View>
      {right ?? defaultRight}
    </View>
  );
}
