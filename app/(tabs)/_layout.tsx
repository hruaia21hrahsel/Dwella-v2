import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Colors } from '@/constants/colors';
import { ProfileHeaderButton } from '@/components/ProfileHeaderButton';
import { DwellaHeaderTitle } from '@/components/DwellaHeaderTitle';
import { AssistantHeaderButton } from '@/components/AssistantHeaderButton';
import { CustomTabBar } from '@/components/CustomTabBar';

function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarAllowFontScaling: false,
        headerStyle: {
          backgroundColor: Colors.surface,
          height: 96,
        },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
        headerTitle: () => null,
        headerBackground: () => (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
            <DwellaHeaderTitle />
          </View>
        ),
        headerLeft: () => <ProfileHeaderButton />,
        headerRight: () => <AssistantHeaderButton />,
      }}
    >
      <Tabs.Screen name="dashboard/index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="properties"      options={{ title: 'Property' }} />
<Tabs.Screen name="payments/index"  options={{ title: 'Payments' }} />
      <Tabs.Screen name="expenses/index"  options={{ title: 'Expenses' }} />
      <Tabs.Screen name="bot/index"       options={{ title: 'Assistant', href: null }} />
      <Tabs.Screen name="profile/index"   options={{ title: 'Profile', href: null, headerLeft: () => null }} />
    </Tabs>
  );
}

export default TabsLayout;
