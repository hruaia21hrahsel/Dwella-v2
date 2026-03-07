import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Colors } from '@/constants/colors';
import { DwellaHeader } from '@/components/DwellaHeader';
import { AssistantHeaderButton } from '@/components/AssistantHeaderButton';
import { NotificationsHeaderButton } from '@/components/NotificationsHeaderButton';
import { CustomTabBar } from '@/components/CustomTabBar';

function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarAllowFontScaling: false,
        header: () => (
          <DwellaHeader
            right={
              <View style={{ flexDirection: 'row' }}>
                <NotificationsHeaderButton />
                <AssistantHeaderButton />
              </View>
            }
          />
        ),
      }}
    >
      <Tabs.Screen name="dashboard/index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="properties"      options={{ title: 'Property' }} />
      <Tabs.Screen name="payments/index"  options={{ title: 'Payments' }} />
      <Tabs.Screen name="expenses/index"  options={{ title: 'Expenses' }} />
      <Tabs.Screen name="bot/index"       options={{ title: 'Assistant', href: null }} />
      <Tabs.Screen name="profile/index"   options={{ title: 'Profile', href: null, headerShown: false }} />
    </Tabs>
  );
}

export default TabsLayout;
