import { describe, expect, it } from 'vitest';

import {
  decideModalDismissal,
  type ModalCloseReason,
  type ModalDismissalMode,
  type ModalPresentation,
} from './modal-dismissal';

const decide = (
  mode: ModalDismissalMode,
  reason: ModalCloseReason,
  options: {
    dirty?: boolean;
    busy?: boolean;
    presentation?: ModalPresentation;
    closeOnOutsideClick?: boolean;
  } = {},
) =>
  decideModalDismissal({
    mode,
    presentation: options.presentation ?? 'dialog',
    reason,
    dirty: options.dirty ?? false,
    busy: options.busy ?? false,
    closeOnOutsideClick: options.closeOnOutsideClick ?? true,
    closeOnEscape: true,
  });

describe('modal dismissal policy', () => {
  it('allows ordinary view modals to close from outside and Escape', () => {
    expect(decide('view', 'backdrop')).toEqual({ kind: 'allow' });
    expect(decide('view', 'escape')).toEqual({ kind: 'allow' });
  });

  it('pulses dialogs instead of closing them from the backdrop or a drag', () => {
    expect(decide('dialog', 'backdrop')).toEqual({
      kind: 'block',
      pulse: true,
    });
    expect(decide('dialog', 'gesture')).toEqual({
      kind: 'block',
      pulse: true,
    });
    expect(decide('dialog', 'escape')).toEqual({ kind: 'allow' });
  });

  it('allows confirmation sheets to close from the backdrop', () => {
    expect(decide('dialog', 'backdrop', { presentation: 'sheet' })).toEqual({
      kind: 'allow',
    });
    expect(decide('dialog', 'gesture', { presentation: 'sheet' })).toEqual({
      kind: 'block',
      pulse: true,
    });
  });

  it('respects explicit outside-click locks on sheets', () => {
    expect(
      decide('dialog', 'backdrop', {
        presentation: 'sheet',
        closeOnOutsideClick: false,
      }),
    ).toEqual({ kind: 'block', pulse: true });
  });

  it('closes pristine forms without a confirmation', () => {
    expect(decide('form', 'backdrop')).toEqual({ kind: 'allow' });
    expect(decide('form', 'escape')).toEqual({ kind: 'allow' });
  });

  it('pulses dirty forms on backdrop dismissal', () => {
    expect(decide('form', 'backdrop', { dirty: true })).toEqual({
      kind: 'block',
      pulse: true,
    });
  });

  it('confirms dirty implicit closures but trusts explicit close controls', () => {
    expect(decide('form', 'gesture', { dirty: true })).toEqual({
      kind: 'confirm',
    });
    expect(decide('form', 'escape', { dirty: true })).toEqual({
      kind: 'confirm',
    });
    expect(decide('form', 'history', { dirty: true })).toEqual({
      kind: 'confirm',
    });
    expect(decide('form', 'explicit', { dirty: true })).toEqual({
      kind: 'allow',
    });
  });

  it('blocks every close route while busy', () => {
    for (const reason of [
      'backdrop',
      'escape',
      'gesture',
      'history',
      'programmatic',
      'explicit',
    ] satisfies ModalCloseReason[]) {
      expect(decide('form', reason, { busy: true })).toEqual({
        kind: 'block',
        pulse: false,
      });
    }
  });
});
