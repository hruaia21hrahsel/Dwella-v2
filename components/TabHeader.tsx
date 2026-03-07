import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { DwellaHeaderTitle } from './DwellaHeaderTitle';
import { ProfileHeaderButton } from './ProfileHeaderButton';

const CONTENT_HEIGHT = 96;

export function TabHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top, height: insets.top + CONTENT_HEIGHT }]}>
      <ProfileHeaderButton />
      <View style={styles.title}>
        <DwellaHeaderTitle />
      </View>
      <View style={{ width: 50 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  title: {
    flex: 1,
    alignItems: 'center',
  },
});
