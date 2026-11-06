import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  readViewFromPath,
  stripViewPath,
  urlForView,
  viewPath,
} from './view-paths';

const stubWindow = (pathname: string, search = '', hash = '') => {
  vi.stubGlobal('window', {
    location: { pathname, search, hash },
  });
};

const stubHistory = (state: Record<string, unknown> | null = null) => {
  const replaceState = vi.fn();
  vi.stubGlobal('history', { state, replaceState });
  return replaceState;
};

describe('view paths', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps views to their paths', () => {
    expect(viewPath('flights')).toBe('/flights');
    expect(viewPath('statistics')).toBe('/statistics');
  });

  it('resolves the view path from the map page', () => {
    stubWindow('/');

    expect(urlForView('flights')).toBe('/flights');
    expect(urlForView('statistics')).toBe('/statistics');
  });

  it('stays inert outside the map page', () => {
    stubWindow('/share/abc');

    expect(urlForView('flights')).toBeUndefined();
    expect(readViewFromPath()).toBeUndefined();
  });

  it('reads the view back from the path', () => {
    stubWindow('/flights');
    expect(readViewFromPath()).toBe('flights');

    stubWindow('/statistics/');
    expect(readViewFromPath()).toBe('statistics');

    stubWindow('/');
    expect(readViewFromPath()).toBeUndefined();
  });

  it('strips the view path while keeping params, hash and history state', () => {
    stubWindow('/flights', '?onboarding=1', '#team');
    const replaceState = stubHistory({ 'sveltekit:history-index': 42 });

    stripViewPath();

    expect(replaceState).toHaveBeenCalledWith(
      { 'sveltekit:history-index': 42 },
      '',
      '/?onboarding=1#team',
    );
  });

  it('strips down to a bare slash when nothing follows', () => {
    stubWindow('/statistics');
    const replaceState = stubHistory(null);

    stripViewPath();

    expect(replaceState).toHaveBeenCalledWith({}, '', '/');
  });
});
