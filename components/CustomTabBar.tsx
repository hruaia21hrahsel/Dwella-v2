import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

const TAB_HEIGHT = Platform.select({ ios: 49, android: 56, default: 56 })!;

// Display config for each real tab, keyed by Expo Router screen name
const TAB_CONFIG: Record<string, { label: string; icon: string }> = {
  'dashboard/index': { label: 'Dashboard', icon: 'view-dashboard' },
  properties:        { label: 'Property',  icon: 'home-city' },
  'payments/index':  { label: 'Payments',  icon: 'receipt' },
  'expenses/index':  { label: 'Expenses',  icon: 'cash-minus' },
};

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // Only the 4 navigable tabs (skip log-payment, bot, profile)
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
        <MaterialCommunityIcons name={cfg.icon as any} size={24} color={color} />
        <Text style={[styles.label, { color }]}>{cfg.label}</Text>
      </TouchableOpacity>
    );
  }

  const left  = visibleRoutes.slice(0, 2); // Dashboard, Property
  const right = visibleRoutes.slice(2);    // Payments, Expenses

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: TAB_HEIGHT + insets.bottom }]}>
      {left.map((r) => <TabButton key={r.key} route={r} />)}

      {/* Center slot — empty space for the LogPaymentFab Portal */}
      <View style={styles.tab} />

      {right.map((r) => <TabButton key={r.key} route={r} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    shadowColor: '#134E4A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
  },
});
