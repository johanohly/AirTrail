import { writable } from 'svelte/store';

type ConfirmActions = {
  onConfirm: () => void;
  onCancel: () => void;
};

type ConfirmOptions = {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
};

export type Confirm = ConfirmOptions & ConfirmActions;

function createConfirmWrapper() {
  const confirm = writable<Confirm | undefined>();

  async function show(options: ConfirmOptions) {
    return new Promise<boolean>((resolve) => {
      const newConfirm: Confirm = {
        ...options,
        onConfirm: () => {
          resolve(true);
          // To allow for transition
          setTimeout(() => confirm.set(undefined), 200);
        },
        onCancel: () => {
          resolve(false);
          setTimeout(() => confirm.set(undefined), 200);
        },
      };

      confirm.set(newConfirm);
    });
  }

  return {
    confirmProps: confirm,
    show,
  };
}

export const confirmation = createConfirmWrapper();
