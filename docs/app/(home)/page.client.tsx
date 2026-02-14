'use client';

import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// The flight route path - shared between the visible line, dots, and plane animation
const FLIGHT_PATH =
  'M100 480 C250 460, 380 220, 550 240 S780 380, 950 180 S1180 220, 1300 120';

// Animated flight path SVG that traces across the hero
export function FlightPath({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <svg
      viewBox="0 0 1400 600"
      fill="none"
      className={cn(
        'absolute inset-0 size-full transition-opacity duration-1000',
        mounted ? 'opacity-100' : 'opacity-0',
        className,
      )}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Flight path curve */}
      <path
        id="flightRoute"
        d={FLIGHT_PATH}
        stroke="url(#flightGradient)"
        strokeWidth="2"
        strokeDasharray="8 6"
        fill="none"
        className="flight-path-line"
      />

      {/* Departure dot -- at the start of the path (100, 480) */}
      <circle cx="100" cy="480" r="5" className="fill-fd-primary/60" />
      <circle cx="100" cy="480" r="10" className="fill-fd-primary/15" />

      {/* Arrival dot -- at the end of the path (1300, 120), pulsing */}
      <circle
        cx="1300"
        cy="120"
        r="5"
        className="fill-fd-primary flight-dot-pulse"
      />
      <circle
        cx="1300"
        cy="120"
        r="12"
        className="fill-fd-primary/15 flight-dot-pulse"
      />

      {/* Airplane that follows the path */}
      {/* The outer <g> receives animateMotion; inner rotation corrects for
          the SVG path pointing up (nose at -Y) vs animateMotion's 0° = +X */}
      <g className="flight-plane-group" style={{ opacity: 0 }}>
        <g transform="rotate(90)">
          <path
            d="M0 -10 L2 -8 L2 -3 L8 2 L8 4 L2 1 L2 5 L4 7 L4 8.5 L0 7 L-4 8.5 L-4 7 L-2 5 L-2 1 L-8 4 L-8 2 L-2 -3 L-2 -8 Z"
            className="fill-fd-primary"
            transform="scale(1.4)"
          />
        </g>
        {/* animateMotion moves the plane along the flight path */}
        <animateMotion
          dur="4s"
          begin="0.5s"
          fill="freeze"
          rotate="auto"
          keyPoints="0;1"
          keyTimes="0;1"
          calcMode="spline"
          keySplines="0.25 0.1 0.25 1"
        >
          <mpath href="#flightRoute" />
        </animateMotion>
        {/* Show the plane when the animation starts */}
        <animate
          attributeName="opacity"
          from="0"
          to="1"
          dur="0.3s"
          begin="0.5s"
          fill="freeze"
        />
      </g>

      <defs>
        <linearGradient id="flightGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop
            offset="0%"
            stopColor="var(--color-fd-primary)"
            stopOpacity="0.15"
          />
          <stop
            offset="20%"
            stopColor="var(--color-fd-primary)"
            stopOpacity="0.5"
          />
          <stop
            offset="60%"
            stopColor="var(--color-fd-primary)"
            stopOpacity="0.7"
          />
          <stop
            offset="100%"
            stopColor="var(--color-fd-primary)"
            stopOpacity="0.4"
          />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Copy button helper
function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center justify-center rounded-md border bg-fd-secondary px-2 py-1 text-fd-muted-foreground text-xs transition-colors hover:bg-fd-accent hover:text-fd-foreground',
        className ?? '',
      )}
      title="Copy to clipboard"
    >
      {copied ? (
        <svg
          className="size-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          className="size-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

// Install command with typewriter on first view, then static + copy button
const INSTALL_CMD =
  'bash <(curl -o- https://raw.githubusercontent.com/JohanOhly/AirTrail/main/scripts/install.sh)';

export function InstallCommand() {
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [tick, setTick] = useState(0);
  const finished = tick >= INSTALL_CMD.length;

  // Start typing once visible
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.unobserve(element);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Typewriter tick
  useEffect(() => {
    if (!started || finished) return;
    const timer = setTimeout(() => setTick((prev) => prev + 1), 35);
    return () => clearTimeout(timer);
  }, [started, tick, finished]);

  return (
    <div ref={ref} className="relative mt-6 w-full">
      <pre className="overflow-x-auto rounded-xl border bg-fd-card text-sm shadow-lg">
        <div className="flex flex-row items-center gap-2 border-b px-4 py-2.5 text-fd-muted-foreground">
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <span className="font-medium text-xs tracking-wide uppercase">
            Terminal
          </span>
          <div className="grow" />
          <CopyButton text={INSTALL_CMD} />
        </div>
        <code className="block p-4 text-fd-foreground">
          <span className="select-none text-fd-primary">$ </span>
          {started ? INSTALL_CMD.substring(0, tick) : ''}
          {started && !finished && (
            <span className="inline-block h-4 w-[2px] animate-pulse bg-fd-primary align-middle" />
          )}
        </code>
      </pre>
    </div>
  );
}

// Inline copy for a URL string
export function CopyableUrl({ url }: { url: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <code className="rounded bg-fd-muted px-1.5 py-0.5 text-fd-foreground">
        {url}
      </code>
      <CopyButton text={url} />
    </span>
  );
}

// Staggered fade-in wrapper for cards
export function FadeInOnScroll({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(element);
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// Lightbox overlay for enlarged image
function ImageLightbox({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="lightbox-overlay fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-4 backdrop-blur-sm md:p-8"
      onClick={onClose}
    >
      <img
        src="/dark.png"
        alt="AirTrail screenshot"
        className="lightbox-image hidden max-h-[90vh] max-w-full rounded-lg shadow-2xl dark:block"
      />
      <img
        src="/light.png"
        alt="AirTrail screenshot"
        className="lightbox-image max-h-[90vh] max-w-full rounded-lg shadow-2xl dark:hidden"
      />
    </div>
  );
}

// Preview image (mobile full-width) -- click to enlarge
export function PreviewImage(props: ComponentProps<'div'>) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <div
        {...props}
        className={cn(
          'relative cursor-zoom-in overflow-hidden rounded-xl border shadow-2xl',
          props.className ?? '',
        )}
        onClick={() => setLightboxOpen(true)}
      >
        <img
          src="/dark.png"
          alt="AirTrail screenshot"
          className="hidden w-full dark:block"
        />
        <img
          src="/light.png"
          alt="AirTrail screenshot"
          className="w-full dark:hidden"
        />
      </div>
      {lightboxOpen && <ImageLightbox onClose={() => setLightboxOpen(false)} />}
    </>
  );
}

// Hero image (desktop, absolute-positioned in hero) -- click to enlarge
export function HeroImage({ className }: { className?: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <div
        className={cn('cursor-zoom-in pointer-events-auto', className ?? '')}
        onClick={() => setLightboxOpen(true)}
      >
        <img
          src="/dark.png"
          alt="AirTrail preview"
          className="hidden rounded-xl border shadow-2xl dark:block"
        />
        <img
          src="/light.png"
          alt="AirTrail preview"
          className="rounded-xl border shadow-2xl dark:hidden"
        />
      </div>
      {lightboxOpen && <ImageLightbox onClose={() => setLightboxOpen(false)} />}
    </>
  );
}
