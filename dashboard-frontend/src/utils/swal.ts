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

export const showDeleteRecordingConfirm = async (
  hasDriveFile: boolean
): Promise<{ confirmed: boolean; deleteFromDrive: boolean }> => {
  const dark = isDarkMode();

  const driveSectionHtml = hasDriveFile
    ? `
      <div style="margin-top: 18px; padding: 14px 16px; background: ${dark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(241, 245, 249, 0.9)'}; border: 1px solid ${dark ? 'rgba(51, 65, 85, 0.8)' : 'rgba(226, 232, 240, 0.9)'}; border-radius: 14px; text-align: left;">
        <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer; user-select: none;">
          <input type="checkbox" id="rb-delete-drive-checkbox" style="width: 17px; height: 17px; margin-top: 2px; accent-color: #ef4444; cursor: pointer; flex-shrink: 0;" />
          <div>
            <div style="font-weight: 600; font-size: 13px; color: ${dark ? '#f1f5f9' : '#1e293b'};">
              También eliminar el archivo en Google Drive
            </div>
            <div style="font-size: 11px; margin-top: 3px; color: ${dark ? '#94a3b8' : '#64748b'}; line-height: 1.4;">
              Se enviará a la papelera de Google Drive. Si no lo seleccionas, el video se conservará intacto en tu Drive.
            </div>
          </div>
        </label>
      </div>
    `
    : `
      <div style="margin-top: 10px; font-size: 13px; color: ${dark ? '#94a3b8' : '#64748b'};">
        El registro se eliminará del historial del bot.
      </div>
    `;

  const html = `
    <div style="text-align: center;">
      <p style="margin: 0; font-size: 14px; color: ${dark ? '#cbd5e1' : '#475569'}; line-height: 1.5;">
        Se eliminará este registro del historial del bot.
      </p>
      ${driveSectionHtml}
    </div>
  `;

  const result = await Swal.fire({
    title: '¿Eliminar registro?',
    html,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    focusCancel: true,
    background: dark ? '#0f172a' : '#ffffff',
    color: dark ? '#f8fafc' : '#0f172a',
    buttonsStyling: false,
    customClass: {
      popup: 'rb-modal-popup',
      title: 'rb-modal-title',
      htmlContainer: 'rb-modal-text',
      actions: 'rb-modal-actions',
      confirmButton: 'rb-btn-destructive',
      cancelButton: 'rb-btn-cancel',
    },
    preConfirm: () => {
      const checkbox = document.getElementById('rb-delete-drive-checkbox') as HTMLInputElement | null;
      return {
        deleteFromDrive: checkbox ? checkbox.checked : false,
      };
    },
  });

  return {
    confirmed: result.isConfirmed,
    deleteFromDrive: Boolean(result.isConfirmed && result.value && result.value.deleteFromDrive),
  };
};

export default Swal;
