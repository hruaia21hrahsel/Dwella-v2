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
      {/* Design 2: concentric rings from top-right */}
      <View style={[styles.ring1, { borderColor: colors.primary + '22' }]} />
      <View style={[styles.ring2, { borderColor: colors.primary + '14' }]} />
      <View style={[styles.ring3, { borderColor: colors.primary + '0A' }]} />

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
  ring1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    top: -60,
    right: -60,
  },
  ring2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    top: -100,
    right: -100,
  },
  ring3: {
    position: 'absolute',
    width: 290,
    height: 290,
    borderRadius: 145,
    borderWidth: 1,
    top: -145,
    right: -145,
  },
});
