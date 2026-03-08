import { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { ProfileHeaderButton } from '@/components/ProfileHeaderButton';
import { DwellaHeaderTitle } from '@/components/DwellaHeaderTitle';

interface Props {
  right?: ReactNode;
}

export function DwellaHeader({ right }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: '#fff',
        paddingTop: insets.top,
        height: 56 + insets.top,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border,
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
