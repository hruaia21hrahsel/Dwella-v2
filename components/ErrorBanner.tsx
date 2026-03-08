import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface ErrorBannerProps {
  error: string | null;
  onRetry: () => void;
}

export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  if (!error) return null;

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="alert-circle-outline" size={20} color={Colors.error} />
      <Text style={styles.message} numberOfLines={2}>{error}</Text>
      <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.statusOverdueSoft,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 12,
  },
  message: {
    flex: 1,
    fontSize: 13,
    color: Colors.error,
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.error,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
