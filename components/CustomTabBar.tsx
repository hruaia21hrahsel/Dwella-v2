import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

const TAB_HEIGHT = Platform.select({ ios: 64, android: 72, default: 72 })!;
const CIRCLE_RADIUS = 30;
const ASSISTANT_RADIUS = 26;

const TAB_CONFIG: Record<string, { label: string; icon: string }> = {
  'dashboard/index': { label: 'Dashboard', icon: 'view-dashboard' },
  properties:        { label: 'Property',  icon: 'home-city' },
  'payments/index':  { label: 'Payments',  icon: 'receipt' },
  'expenses/index':  { label: 'Expenses',  icon: 'cash-minus' },
};

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const visibleRoutes = state.routes.filter((r) => TAB_CONFIG[r.name]);

  function TabButton({ route }: { route: typeof state.routes[0] }) {
    const cfg = TAB_CONFIG[route.name]!;
    const isFocused = state.routes[state.index]?.key === route.key;
    const color = isFocused ? Colors.primary : Colors.textSecondary;

    function onPress() {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    }

    return (
      <TouchableOpacity style={styles.tab} onPress={onPress} activeOpacity={0.7}>
        <MaterialCommunityIcons name={cfg.icon as any} size={26} color={color} />
        <Text style={[styles.label, { color }]}>{cfg.label}</Text>
      </TouchableOpacity>
    );
  }

  const left  = visibleRoutes.slice(0, 2); // Dashboard, Property
  const right = visibleRoutes.slice(2);    // Payments, Expenses

  return (
    // overflow:visible so the FAB circle can protrude above the bar
    <View style={[styles.container, { height: TAB_HEIGHT + insets.bottom }]}>
      <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
        {left.map((r) => <TabButton key={r.key} route={r} />)}

        {/* Center slot — empty space aligned with the FAB */}
        <View style={styles.tab} />

        {right.map((r) => <TabButton key={r.key} route={r} />)}
      </View>

      {/* AI Assistant FAB — bottom-right, floating above bar */}
      <TouchableOpacity
        style={styles.assistantFab}
        onPress={() => router.push('/(tabs)/bot' as any)}
        activeOpacity={0.85}
      >
        <View style={styles.assistantCircle}>
          <MaterialCommunityIcons name="robot" size={26} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* FAB — absolutely positioned in normal view hierarchy, no Portal */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/log-payment' as any)}
        activeOpacity={0.85}
      >
        <View style={styles.circle}>
          <MaterialCommunityIcons name="plus" size={30} color="#fff" />
        </View>
        <Text style={styles.fabLabel}>Log Payment</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // overflow visible so the circle can protrude above the bar
    overflow: 'visible',
  },
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: TAB_HEIGHT,
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    shadowColor: '#134E4A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 8,
    // Must also be visible so the FAB shadow renders above it on Android
    overflow: 'visible',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    // Center of circle sits on the top edge of the bar
    bottom: TAB_HEIGHT - CIRCLE_RADIUS,
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 10,
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
  fabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 3,
  },
  assistantFab: {
    position: 'absolute',
    bottom: TAB_HEIGHT + 12,
    right: 16,
    zIndex: 10,
  },
  assistantCircle: {
    width: ASSISTANT_RADIUS * 2,
    height: ASSISTANT_RADIUS * 2,
    borderRadius: ASSISTANT_RADIUS,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 10,
  },
});
