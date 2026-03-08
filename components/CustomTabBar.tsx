import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

const TAB_HEIGHT = Platform.select({ ios: 52, android: 56, default: 56 })!;
const FAB_SIZE = 48;

const TAB_CONFIG: Record<string, { label: string; icon: string; iconOutline: string }> = {
  'dashboard/index': { label: 'Home',       icon: 'view-dashboard',  iconOutline: 'view-dashboard-outline' },
  properties:        { label: 'Properties',  icon: 'home-city',       iconOutline: 'home-city-outline' },
  'payments/index':  { label: 'Payments',    icon: 'receipt',         iconOutline: 'text-box-outline' },
  'expenses/index':  { label: 'Expenses',    icon: 'cash-minus',      iconOutline: 'cash-minus' },
  'bot/index':       { label: 'Assistant',   icon: 'robot',           iconOutline: 'robot-outline' },
};

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const visibleRoutes = state.routes.filter((r) => TAB_CONFIG[r.name]);

  function TabButton({ route }: { route: typeof state.routes[0] }) {
    const cfg = TAB_CONFIG[route.name]!;
    const isFocused = state.routes[state.index]?.key === route.key;

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
      <TouchableOpacity style={styles.tab} onPress={onPress} activeOpacity={0.6}>
        <MaterialCommunityIcons
          name={(isFocused ? cfg.icon : cfg.iconOutline) as any}
          size={22}
          color={isFocused ? Colors.primary : Colors.textSecondary}
        />
        <Text
          style={[
            styles.label,
            { color: isFocused ? Colors.primary : Colors.textSecondary },
            isFocused && styles.labelActive,
          ]}
        >
          {cfg.label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View pointerEvents="box-none" style={[styles.container, { height: TAB_HEIGHT + insets.bottom + FAB_SIZE / 2 }]}>
      <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
        {visibleRoutes.map((r) => <TabButton key={r.key} route={r} />)}
      </View>

      {/* Floating FAB — Log Payment */}
      <TouchableOpacity
        style={[styles.fab, { bottom: TAB_HEIGHT + insets.bottom - FAB_SIZE / 2 }]}
        onPress={() => router.push('/log-payment' as any)}
        activeOpacity={0.85}
      >
        <View style={styles.fabCircle}>
          <MaterialCommunityIcons name="plus" size={24} color="#fff" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
  },
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: TAB_HEIGHT,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  labelActive: {
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    zIndex: 10,
  },
  fabCircle: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primaryDark,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
});
