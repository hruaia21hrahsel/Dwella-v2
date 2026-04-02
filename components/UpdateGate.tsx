import { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, Linking } from 'react-native';
import * as Updates from 'expo-updates';
import { Text, Button, Surface } from 'react-native-paper';
import { useTheme } from '@/lib/theme-context';

const STORE_URL = Platform.select({
  ios: 'https://apps.apple.com/app/dwella/id6760478576',
  android: 'https://play.google.com/store/apps/details?id=com.dwella.app',
}) ?? '';

export function UpdateGate({ children }: { children: React.ReactNode }) {
  // Guard: no-op in dev / Expo Go where expo-updates is disabled
  if (!Updates.isEnabled) {
    return <>{children}</>;
  }
  return <UpdateGateInner>{children}</UpdateGateInner>;
}

function UpdateGateInner({ children }: { children: React.ReactNode }) {
  const [needsStoreUpdate, setNeedsStoreUpdate] = useState(false);
  const { colors } = useTheme();
  const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates();

  useEffect(() => {
    if (isUpdatePending) {
      Updates.reloadAsync();
    }
  }, [isUpdatePending]);

  useEffect(() => {
    if (isUpdateAvailable) {
      Updates.fetchUpdateAsync().catch(() => {
        // Fetch failed — runtime fingerprint mismatch, need store update
        setNeedsStoreUpdate(true);
      });
    }
  }, [isUpdateAvailable]);

  if (needsStoreUpdate) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Surface style={[styles.surface, { backgroundColor: colors.surface }]} elevation={4}>
          <Text variant="titleLarge" style={[styles.title, { color: colors.textPrimary }]}>
            Update Required
          </Text>
          <Text variant="bodyMedium" style={[styles.message, { color: colors.textSecondary }]}>
            A new version of Dwella is required to continue. Please update the app from the App Store or Play Store.
          </Text>
          <Button
            mode="contained"
            onPress={() => Linking.openURL(STORE_URL)}
            buttonColor={colors.primary}
          >
            Update App
          </Button>
        </Surface>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  surface: {
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  title: {
    fontWeight: '700',
  },
  message: {
    lineHeight: 22,
  },
});
