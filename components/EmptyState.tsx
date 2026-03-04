import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name={icon as any} size={56} color={Colors.textDisabled} />
      <Text variant="titleMedium" style={styles.title}>{title}</Text>
      {subtitle && (
        <Text variant="bodyMedium" style={styles.subtitle}>{subtitle}</Text>
      )}
      {actionLabel && onAction && (
        <Button
          mode="outlined"
          onPress={onAction}
          style={styles.button}
        >
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  title: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    color: Colors.textDisabled,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
  },
});
