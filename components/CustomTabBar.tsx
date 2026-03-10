import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme-context';

const TAB_HEIGHT = Platform.select({ ios: 60, android: 64, default: 64 })!;

const TAB_CONFIG: Record<string, { label: string; icon: string; iconOutline: string }> = {
  'dashboard/index': { label: 'Home',       icon: 'view-dashboard',  iconOutline: 'view-dashboard-outline' },
  properties:        { label: 'Properties',  icon: 'home-city',       iconOutline: 'home-city-outline' },
  'tools/index':     { label: 'Tools',       icon: 'toolbox',         iconOutline: 'toolbox-outline' },
  'bot/index':       { label: 'Assistant',   icon: 'robot',           iconOutline: 'robot-outline' },
};

// Order: Home, Properties, [Log], Tools, Assistant
const LEFT_TABS = ['dashboard/index', 'properties'];
const RIGHT_TABS = ['tools/index', 'bot/index'];

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, gradients } = useTheme();

  const routeMap = new Map(state.routes.map((r) => [r.name, r]));

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
      <Pressable style={styles.tab} onPress={onPress}>
        <MaterialCommunityIcons
          name={(isFocused ? cfg.icon : cfg.iconOutline) as any}
          size={22}
          color={isFocused ? colors.primary : colors.textSecondary}
        />
        <Text
          style={[
            styles.label,
            { color: isFocused ? colors.primary : colors.textSecondary },
            isFocused && styles.labelActive,
          ]}
        >
          {cfg.label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <View style={styles.bar}>
        {LEFT_TABS.map((name) => {
          const route = routeMap.get(name);
          return route ? <TabButton key={route.key} route={route} /> : null;
        })}

        {/* Log Payment — center slot */}
        <Pressable
          style={styles.tab}
          onPress={() => router.push('/log-payment')}
        >
          <LinearGradient
            colors={gradients.button}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.fabCircle,
              {
                shadowColor: colors.primary,
                shadowOpacity: 0.65,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 0 },
                elevation: 10,
              },
            ]}
          >
            <MaterialCommunityIcons name="plus" size={22} color="#fff" />
          </LinearGradient>
          <Text style={[styles.fabLabel, { color: colors.primary }]}>Log</Text>
        </Pressable>

        {RIGHT_TABS.map((name) => {
          const route = routeMap.get(name);
          return route ? <TabButton key={route.key} route={route} /> : null;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    height: TAB_HEIGHT,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 8,
    paddingBottom: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  labelActive: {
    fontWeight: '600',
  },
  fabCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
