import { View, StyleSheet } from 'react-native';
import { Modal, Portal, Text, Button, Surface } from 'react-native-paper';
import { useTheme } from '@/lib/theme-context';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmColor,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  const resolvedConfirmColor = confirmColor ?? colors.primary;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onCancel}
        contentContainerStyle={styles.container}
      >
        <Surface style={[styles.surface, { backgroundColor: colors.surface }]} elevation={4}>
          <Text variant="titleLarge" style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          <Text variant="bodyMedium" style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          <View style={styles.actions}>
            <Button
              mode="text"
              onPress={onCancel}
              disabled={loading}
              textColor={colors.textSecondary}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={onConfirm}
              loading={loading}
              disabled={loading}
              buttonColor={resolvedConfirmColor}
            >
              {confirmLabel}
            </Button>
          </View>
        </Surface>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 24,
  },
  surface: {
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  title: {
    fontWeight: '700',
  },
  message: {
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
});
