import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Portal } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useSegments } from 'expo-router';
import { Colors } from '@/constants/colors';

// React Navigation default tab bar heights per platform
const TAB_BAR_HEIGHT = Platform.select({ ios: 49, android: 56, default: 56 })!;

// Circle geometry
const CIRCLE_RADIUS = 30; // circle is 60×60
const LABEL_HEIGHT = 13;  // ~fontSize 10 with lineHeight
const LABEL_MARGIN = 3;   // marginTop between circle and label

// For "half outside the tab bar":
//   circle center must sit at the tab bar TOP EDGE.
//   circle center from device bottom = insets.bottom + TAB_BAR_HEIGHT
//   circle bottom from device bottom = insets.bottom + TAB_BAR_HEIGHT - CIRCLE_RADIUS
//
// `bottom` on the container is its BOTTOM EDGE (children flow top → bottom inside it):
//   container holds [circle (60px), label (marginTop 3 + ~13px)]
//   label is the last child so container bottom = label bottom
//   container bottom = circle bottom − LABEL_MARGIN − LABEL_HEIGHT
//                    = insets.bottom + TAB_BAR_HEIGHT − CIRCLE_RADIUS − LABEL_MARGIN − LABEL_HEIGHT
//
// Simplifies to: insets.bottom + TAB_BAR_HEIGHT − 46

export function LogPaymentFab() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  // Only show inside the tabs group
  if (segments[0] !== '(tabs)') return null;

  const fabBottom = insets.bottom + TAB_BAR_HEIGHT - CIRCLE_RADIUS - LABEL_MARGIN - LABEL_HEIGHT;

  return (
    <Portal>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <TouchableOpacity
          style={[styles.fab, { bottom: fabBottom }]}
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
    width: CIRCLE_RADIUS * 2,
    height: CIRCLE_RADIUS * 2,
    borderRadius: CIRCLE_RADIUS,
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
    marginTop: LABEL_MARGIN,
    lineHeight: LABEL_HEIGHT,
  },
});
