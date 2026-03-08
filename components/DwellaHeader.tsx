import { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme-context';
import { ProfileHeaderButton } from '@/components/ProfileHeaderButton';
import { DwellaHeaderTitle } from '@/components/DwellaHeaderTitle';

interface Props {
  right?: ReactNode;
}

export function DwellaHeader({ right }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
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
      {right ?? <View style={{ width: 56 }} />}
    </View>
  );
}
