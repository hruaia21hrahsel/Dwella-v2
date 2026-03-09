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
      colors={[colors.surface, colors.surface]}
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
      {/* Design 3: city skyline silhouette */}
      {[
        { h: 28, w: 14, r: 12 },
        { h: 42, w: 10, r: 28 },
        { h: 20, w: 16, r: 40 },
        { h: 50, w: 12, r: 58 },
        { h: 32, w: 14, r: 72 },
        { h: 44, w: 10, r: 88 },
        { h: 24, w: 18, r: 100 },
        { h: 36, w: 12, r: 120 },
      ].map((b, i) => (
        <View key={i} style={[styles.building, { height: b.h, width: b.w, right: b.r, backgroundColor: colors.primary + '18' }]} />
      ))}

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
  building: {
    position: 'absolute',
    bottom: 0,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
});
