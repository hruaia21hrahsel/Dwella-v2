import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme-context';

interface ErrorBannerProps {
  error: string | null;
  onRetry: () => void;
}

export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  const { colors } = useTheme();

  if (!error) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.statusOverdueSoft }]}>
      <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.error} />
      <Text style={[styles.message, { color: colors.error }]} numberOfLines={2}>{error}</Text>
      <TouchableOpacity onPress={onRetry} style={[styles.retryBtn, { backgroundColor: colors.error }]}>
        <Text style={[styles.retryText, { color: colors.textOnPrimary }]}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 12,
  },
  message: {
    flex: 1,
    fontSize: 13,
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
