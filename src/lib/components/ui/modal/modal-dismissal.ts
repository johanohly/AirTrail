import { confirmation } from '$lib/components/helpers/confirm';

export type ModalDismissalMode = 'view' | 'dialog' | 'form';
export type ModalPresentation = 'dialog' | 'sheet';

export type ModalCloseReason =
  'backdrop' | 'escape' | 'gesture' | 'history' | 'programmatic' | 'explicit';

export type ModalDismissalDecision =
  { kind: 'allow' } | { kind: 'block'; pulse: boolean } | { kind: 'confirm' };

export const decideModalDismissal = ({
  mode,
  presentation,
  reason,
  dirty,
  busy,
  closeOnOutsideClick,
  closeOnEscape,
}: {
  mode: ModalDismissalMode;
  presentation: ModalPresentation;
  reason: ModalCloseReason;
  dirty: boolean;
  busy: boolean;
  closeOnOutsideClick: boolean;
  closeOnEscape: boolean;
}): ModalDismissalDecision => {
  if (busy) return { kind: 'block', pulse: false };

  if (reason === 'backdrop' && !closeOnOutsideClick) {
    return { kind: 'block', pulse: mode !== 'view' };
  }
  if (reason === 'escape' && !closeOnEscape) {
    return { kind: 'block', pulse: false };
  }

  if (mode === 'dialog') {
    return reason === 'gesture' ||
      (reason === 'backdrop' && presentation === 'dialog')
      ? { kind: 'block', pulse: true }
      : { kind: 'allow' };
  }

  if (mode === 'form' && dirty) {
    if (reason === 'backdrop') {
      return { kind: 'block', pulse: true };
    }
    if (reason !== 'explicit') return { kind: 'confirm' };
  }

  return { kind: 'allow' };
};

export const confirmDiscardChanges = () =>
  confirmation.show({
    title: 'Discard changes?',
    description: 'Your unsaved changes will be lost.',
    confirmText: 'Discard',
    cancelText: 'Keep editing',
  });
