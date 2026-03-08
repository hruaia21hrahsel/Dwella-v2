import { View, StyleSheet } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { useToastStore, ToastType } from '@/lib/toast';
import { useTheme } from '@/lib/theme-context';

export function ToastProvider() {
  const { colors } = useTheme();
  const { visible, message, type, hideToast } = useToastStore();

  if (!visible) return null;

  const BG: Record<ToastType, string> = {
    success: colors.success,
    error: colors.error,
    info: colors.primary,
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <Snackbar
        visible={visible}
        onDismiss={hideToast}
        duration={3000}
        style={{ backgroundColor: BG[type] }}
        action={{ label: 'OK', textColor: colors.textOnPrimary, onPress: hideToast }}
      >
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
});
