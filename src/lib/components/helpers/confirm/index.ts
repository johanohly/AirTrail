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
  let pendingResolve: ((value: boolean) => void) | null = null;

  async function show(options: ConfirmOptions) {
    if (pendingResolve) {
      pendingResolve(false);
      pendingResolve = null;
    }

    return new Promise<boolean>((resolve) => {
      pendingResolve = resolve;

      const newConfirm: Confirm = {
        ...options,
        onConfirm: () => {
          pendingResolve = null;
          resolve(true);
          // To allow for transition
          setTimeout(() => confirm.set(undefined), 200);
        },
        onCancel: () => {
          pendingResolve = null;
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
