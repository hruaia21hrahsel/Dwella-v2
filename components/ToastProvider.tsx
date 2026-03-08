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

  return (
    <Snackbar
      visible={visible}
      onDismiss={hideToast}
      duration={3000}
      style={{ backgroundColor: BG[type], bottom: 80 }}
      action={{ label: 'OK', textColor: '#fff', onPress: hideToast }}
    >
      {message}
    </Snackbar>
  );
}
