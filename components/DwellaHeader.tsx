import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme-context';
import { ProfileHeaderButton } from '@/components/ProfileHeaderButton';
import { NotificationsHeaderButton } from '@/components/NotificationsHeaderButton';

export function DwellaHeader() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

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
      ]}
    >
      <ProfileHeaderButton />
      <View style={{ flex: 1 }} />
      <NotificationsHeaderButton />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
