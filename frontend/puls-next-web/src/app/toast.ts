export type ToastType = 'create' | 'update' | 'delete' | 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
  durationMs: number;
}

export const TOAST_EVENT = 'puls-toast';

let nextToastId = 1;

export function showToast(message: string, type: ToastType = 'info', durationMs = 3000) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<ToastMessage>(TOAST_EVENT, {
    detail: {
      id: nextToastId++,
      message,
      type,
      durationMs
    }
  }));
}
