import { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    <LinearGradient
      colors={[colors.surface, colors.primarySoft]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[
        styles.header,
        {
          paddingTop: insets.top,
          height: 60 + insets.top,
          shadowColor: colors.primary,
        },
      ]}
    >
      {/* Design 1: bloom circle top-right */}
      <View style={[styles.bloomCircle, { backgroundColor: colors.primaryMid + '22' }]} />

      <ProfileHeaderButton dark />
      <View style={{ flex: 1, alignItems: 'center' }}>
        <DwellaHeaderTitle dark />
      </View>
      {right ?? defaultRight}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 3,
  },
  bloomCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -80,
    right: -30,
  },
});
