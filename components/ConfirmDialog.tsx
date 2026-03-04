import { View, StyleSheet } from 'react-native';
import { Modal, Portal, Text, Button, Surface } from 'react-native-paper';
import { Colors } from '@/constants/colors';

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
  confirmColor = Colors.primary,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onCancel}
        contentContainerStyle={styles.container}
      >
        <Surface style={styles.surface} elevation={4}>
          <Text variant="titleLarge" style={styles.title}>{title}</Text>
          <Text variant="bodyMedium" style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Button
              mode="text"
              onPress={onCancel}
              disabled={loading}
              textColor={Colors.textSecondary}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={onConfirm}
              loading={loading}
              disabled={loading}
              buttonColor={confirmColor}
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
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  message: {
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
});
