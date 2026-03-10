import { Tabs } from 'expo-router';
import { useTheme } from '@/lib/theme-context';
import { DwellaHeader } from '@/components/DwellaHeader';
import { CustomTabBar } from '@/components/CustomTabBar';

function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarAllowFontScaling: false,
        header: () => <DwellaHeader />,
      }}
    >
      <Tabs.Screen name="dashboard/index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="properties"      options={{ title: 'Property' }} />
      <Tabs.Screen name="tools/index"     options={{ title: 'Tools' }} />
      <Tabs.Screen name="bot/index"       options={{ title: 'Assistant' }} />
      <Tabs.Screen name="profile/index"   options={{ title: 'Profile', href: null }} />
    </Tabs>
  );
}

export default TabsLayout;
