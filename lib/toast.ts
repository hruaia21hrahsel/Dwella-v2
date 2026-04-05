import { create } from 'zustand';
import { haptics } from './haptics';

export type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  message: '',
  type: 'info',
  showToast: (message, type = 'info') => {
    // Every toast is an async signal the user should feel, not just see.
    if (type === 'success') haptics.success();
    else if (type === 'error') haptics.error();
    else haptics.tap();
    set({ visible: true, message, type });
  },
  hideToast: () => set({ visible: false }),
}));
