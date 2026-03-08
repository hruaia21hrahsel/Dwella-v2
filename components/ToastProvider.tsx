import { View, StyleSheet } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { useToastStore, ToastType } from '@/lib/toast';
import { Colors } from '@/constants/colors';

const BG: Record<ToastType, string> = {
  success: Colors.statusConfirmed,
  error: Colors.error,
  info: Colors.primary,
};

export function ToastProvider() {
  const { visible, message, type, hideToast } = useToastStore();

  if (!visible) return null;

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <Snackbar
        visible={visible}
        onDismiss={hideToast}
        duration={3000}
        style={{ backgroundColor: BG[type] }}
        action={{ label: 'OK', textColor: '#fff', onPress: hideToast }}
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
