export interface HighlightOptions {
  duration?: number;
  scroll?: boolean;
  scrollBehavior?: ScrollBehavior;
  scrollOffset?: number;
  pulses?: number;
}

type HighlightTarget = string | HTMLElement;

const styleId = 'airtrail-highlight-styles';
const activeHighlights = new WeakMap<HTMLElement, () => void>();

const resolveElement = (target: HighlightTarget) =>
  typeof target === 'string'
    ? document.querySelector<HTMLElement>(target)
    : target;

export const injectHighlightStyles = () => {
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .airtrail-highlight-overlay {
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      border: 2px solid var(--primary);
      border-radius: 10px;
      opacity: 0;
      transform-origin: center;
      animation-name: airtrail-highlight-pulse;
      animation-timing-function: ease-out;
      animation-duration: 0.6s;
      animation-iteration-count: var(--airtrail-highlight-pulses, 3);
    }

    @keyframes airtrail-highlight-pulse {
      0%, 100% {
        opacity: 0;
        transform: scale(1);
        box-shadow: 0 0 0 0 transparent;
      }
      45% {
        opacity: 0.92;
        transform: scale(1.012);
        box-shadow: 0 0 0 6px color-mix(in oklch, var(--primary) 18%, transparent);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .airtrail-highlight-overlay {
        animation: none;
        opacity: 0.9;
        box-shadow: 0 0 0 6px color-mix(in oklch, var(--primary) 14%, transparent);
      }
    }
  `;
  document.head.appendChild(style);
};

export const cancelHighlight = (target: HighlightTarget) => {
  const element = resolveElement(target);
  if (!element) return;
  activeHighlights.get(element)?.();
};

export const highlightElement = (
  target: HighlightTarget,
  options: HighlightOptions = {},
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const {
      duration = 1900,
      scroll = true,
      scrollBehavior = 'smooth',
      scrollOffset = -100,
      pulses = 3,
    } = options;

    const element = resolveElement(target);
    if (!element) {
      reject(new Error(`Element not found: ${target}`));
      return;
    }

    injectHighlightStyles();
    cancelHighlight(element);

    if (scroll) {
      const rect = element.getBoundingClientRect();
      window.scrollTo({
        top: rect.top + window.scrollY + scrollOffset,
        behavior: scrollBehavior,
      });
    }

    const overlay = document.createElement('div');
    overlay.className = 'airtrail-highlight-overlay';
    overlay.style.setProperty('--airtrail-highlight-pulses', pulses.toString());
    document.body.appendChild(overlay);

    let frame = 0;
    let cancelled = false;

    const update = () => {
      if (cancelled) return;

      const rect = element.getBoundingClientRect();
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        rect.top <= window.innerHeight &&
        rect.left <= window.innerWidth;

      overlay.style.display = visible ? 'block' : 'none';
      overlay.style.left = `${rect.left - 4}px`;
      overlay.style.top = `${rect.top - 4}px`;
      overlay.style.width = `${rect.width + 8}px`;
      overlay.style.height = `${rect.height + 8}px`;

      frame = requestAnimationFrame(update);
    };

    const cleanup = () => {
      if (cancelled) return;
      cancelled = true;
      cancelAnimationFrame(frame);
      overlay.remove();
      activeHighlights.delete(element);
      resolve();
    };

    activeHighlights.set(element, cleanup);
    frame = requestAnimationFrame(update);
    window.setTimeout(cleanup, duration);
  });
};
