import { ReactNode } from 'react';
import { View } from 'react-native';
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
        backgroundColor: Colors.primary,
        paddingTop: insets.top,
        height: 60 + insets.top,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <ProfileHeaderButton />
      <View style={{ flex: 1, alignItems: 'center' }}>
        <DwellaHeaderTitle />
      </View>
      {right ?? <View style={{ width: 56 }} />}
    </View>
  );
}
