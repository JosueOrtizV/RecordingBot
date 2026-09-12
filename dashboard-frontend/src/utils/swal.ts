import Swal, { SweetAlertIcon } from 'sweetalert2';

const isDarkMode = (): boolean => {
  return document.documentElement.classList.contains('dark');
};

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3500,
  timerProgressBar: true,
  showCloseButton: true,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  },
});

export const showToast = {
  success: (title: string, message?: string) => {
    const dark = isDarkMode();
    return Toast.fire({
      icon: 'success',
      title,
      text: message,
      background: dark ? '#0f172a' : '#ffffff',
      color: dark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rb-toast-popup rb-toast-success',
        title: 'rb-toast-title',
        htmlContainer: 'rb-toast-html',
        timerProgressBar: 'rb-progress-success',
      },
    });
  },

  error: (title: string, message?: string) => {
    const dark = isDarkMode();
    return Toast.fire({
      icon: 'error',
      title,
      text: message,
      background: dark ? '#0f172a' : '#ffffff',
      color: dark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rb-toast-popup rb-toast-error',
        title: 'rb-toast-title',
        htmlContainer: 'rb-toast-html',
        timerProgressBar: 'rb-progress-error',
      },
    });
  },

  info: (title: string, message?: string) => {
    const dark = isDarkMode();
    return Toast.fire({
      icon: 'info',
      title,
      text: message,
      background: dark ? '#0f172a' : '#ffffff',
      color: dark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rb-toast-popup rb-toast-info',
        title: 'rb-toast-title',
        htmlContainer: 'rb-toast-html',
        timerProgressBar: 'rb-progress-info',
      },
    });
  },

  warning: (title: string, message?: string) => {
    const dark = isDarkMode();
    return Toast.fire({
      icon: 'warning',
      title,
      text: message,
      background: dark ? '#0f172a' : '#ffffff',
      color: dark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rb-toast-popup rb-toast-warning',
        title: 'rb-toast-title',
        htmlContainer: 'rb-toast-html',
        timerProgressBar: 'rb-progress-warning',
      },
    });
  },
};

export interface ConfirmOptions {
  title: string;
  text?: string;
  html?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: SweetAlertIcon;
  isDestructive?: boolean;
}

export const showConfirm = async (options: ConfirmOptions): Promise<boolean> => {
  const dark = isDarkMode();
  const result = await Swal.fire({
    title: options.title,
    text: options.text,
    html: options.html,
    icon: options.icon || (options.isDestructive ? 'warning' : 'question'),
    showCancelButton: true,
    confirmButtonText: options.confirmText || 'Confirmar',
    cancelButtonText: options.cancelText || 'Cancelar',
    reverseButtons: true,
    focusCancel: options.isDestructive,
    background: dark ? '#0f172a' : '#ffffff',
    color: dark ? '#f8fafc' : '#0f172a',
    buttonsStyling: false,
    customClass: {
      popup: 'rb-modal-popup',
      title: 'rb-modal-title',
      htmlContainer: 'rb-modal-text',
      actions: 'rb-modal-actions',
      confirmButton: options.isDestructive ? 'rb-btn-destructive' : 'rb-btn-confirm',
      cancelButton: 'rb-btn-cancel',
    },
  });

  return result.isConfirmed;
};

export const showAlert = async (options: {
  title: string;
  text?: string;
  icon?: SweetAlertIcon;
}): Promise<void> => {
  const dark = isDarkMode();
  await Swal.fire({
    title: options.title,
    text: options.text,
    icon: options.icon || 'info',
    confirmButtonText: 'Entendido',
    background: dark ? '#0f172a' : '#ffffff',
    color: dark ? '#f8fafc' : '#0f172a',
    buttonsStyling: false,
    customClass: {
      popup: 'rb-modal-popup',
      title: 'rb-modal-title',
      htmlContainer: 'rb-modal-text',
      actions: 'rb-modal-actions',
      confirmButton: 'rb-btn-confirm',
    },
  });
};

export default Swal;
