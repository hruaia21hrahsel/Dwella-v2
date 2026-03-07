import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Portal } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useSegments } from 'expo-router';
import { Colors } from '@/constants/colors';

// Must match the actual rendered tab bar height
const TAB_BAR_HEIGHT = 60;

export function LogPaymentFab() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  // Only show inside the tabs group
  if (segments[0] !== '(tabs)') return null;

  // Position the circle so it straddles the top edge of the tab bar.
  // Circle radius = 30, tab bar top is (insets.bottom + TAB_BAR_HEIGHT) from device bottom.
  // Circle bottom = insets.bottom + TAB_BAR_HEIGHT - 30 = insets.bottom + 30
  const circleBottom = insets.bottom + TAB_BAR_HEIGHT - 30;

  return (
    <Portal>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <TouchableOpacity
          style={[styles.fab, { bottom: circleBottom }]}
          onPress={() => router.push('/log-payment' as any)}
          activeOpacity={0.85}
        >
          <View style={styles.circle}>
            <MaterialCommunityIcons name="plus" size={30} color="#fff" />
          </View>
          <Text style={styles.label}>Log Payment</Text>
        </TouchableOpacity>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
  },
  circle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 10,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 3,
  },
});
