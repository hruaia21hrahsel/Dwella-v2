import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export async function registerPushToken(userId: string): Promise<void> {
  if (!Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  // SDK 51+ requires explicit projectId for standalone/EAS builds.
  // In Expo Go the projectId is inferred from the manifest, but in
  // TestFlight / Play Store builds it must be passed explicitly.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn('[Dwella] Expo projectId not found in app config — push token registration skipped');
    return;
  }

  const token = (
    await Notifications.getExpoPushTokenAsync({ projectId })
  ).data;

  const { error: updateError } = await supabase
    .from('users')
    .update({ push_token: token })
    .eq('id', userId);

  if (updateError) {
    console.warn('[Dwella] Failed to store push token:', updateError.message);
  }
}
