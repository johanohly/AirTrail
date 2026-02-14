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
        <g transform="rotate(-90)">
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

// Animated install command with typewriter effect
export function InstallAnimation() {
  const installCmd =
    'bash <(curl -o- https://raw.githubusercontent.com/JohanOhly/AirTrail/main/scripts/install.sh)';
  const tickTime = 40;
  const [tick, setTick] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (tick >= installCmd.length) {
      setFinished(true);
      return;
    }
    const timer = setTimeout(() => {
      setTick((prev) => prev + 1);
    }, tickTime);
    return () => clearTimeout(timer);
  }, [tick, installCmd.length]);

  return (
    <div
      className="group relative mt-6 w-full"
      onMouseEnter={() => {
        if (finished) {
          setTick(0);
          setFinished(false);
        }
      }}
    >
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
          <div className="flex gap-1.5">
            <div className="size-2.5 rounded-full bg-red-400/60" />
            <div className="size-2.5 rounded-full bg-yellow-400/60" />
            <div className="size-2.5 rounded-full bg-green-400/60" />
          </div>
        </div>
        <code className="block p-4 text-fd-foreground">
          <span className="text-fd-primary">$</span>{' '}
          {installCmd.substring(0, tick)}
          {!finished && (
            <span className="inline-block h-4 w-[2px] animate-pulse bg-fd-primary align-middle" />
          )}
        </code>
      </pre>
      {finished && (
        <div className="install-success-popup absolute bottom-3 right-3">
          <div className="overflow-hidden rounded-lg border bg-fd-background shadow-xl">
            <div className="flex h-5 items-center gap-1 border-b bg-fd-muted px-3">
              <div className="size-1.5 rounded-full bg-fd-muted-foreground/30" />
              <div className="size-1.5 rounded-full bg-fd-muted-foreground/30" />
              <div className="size-1.5 rounded-full bg-fd-muted-foreground/30" />
            </div>
            <div className="px-3 py-2 text-xs">
              <span className="text-green-500">&#10003;</span> AirTrail is
              running on <span className="text-fd-primary">localhost:3000</span>
            </div>
          </div>
        </div>
      )}
    </div>
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

// Preview image switcher (dark/light)
export function PreviewImage(props: ComponentProps<'div'>) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      {...props}
      className={cn(
        'relative overflow-hidden rounded-xl border shadow-2xl',
        props.className ?? '',
      )}
    >
      <img
        src="/dark.png"
        alt="AirTrail screenshot"
        className={cn(
          'hidden w-full transition-all duration-700 dark:block',
          loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]',
        )}
        onLoad={() => setLoaded(true)}
      />
      <img
        src="/light.png"
        alt="AirTrail screenshot"
        className={cn(
          'w-full transition-all duration-700 dark:hidden',
          loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]',
        )}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
