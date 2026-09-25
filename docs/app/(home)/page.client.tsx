"use client";

import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

const FLIGHT_PATH =
  "M100 480 C250 460, 380 220, 550 240 S780 380, 950 180 S1180 220, 1300 120";

// Cubic bezier easing (matching the old animateMotion feel)
function cubicBezier(
  t: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number
): number {
  // Newton-Raphson to find t for x, then evaluate y
  let guessT = t;
  for (let i = 0; i < 8; i += 1) {
    const x =
      3 * p1x * guessT * (1 - guessT) ** 2 +
      3 * p2x * guessT ** 2 * (1 - guessT) +
      guessT ** 3;
    const dx =
      3 * p1x * (1 - guessT) ** 2 -
      6 * p1x * guessT * (1 - guessT) +
      6 * p2x * guessT * (1 - guessT) -
      3 * p2x * guessT ** 2 +
      3 * guessT ** 2;
    if (Math.abs(x - t) < 0.0001) {
      break;
    }
    guessT -= (x - t) / dx;
  }
  return (
    3 * p1y * guessT * (1 - guessT) ** 2 +
    3 * p2y * guessT ** 2 * (1 - guessT) +
    guessT ** 3
  );
}

// Animated flight path SVG that traces across the hero
export function FlightPath({ className }: Readonly<{ className?: string }>) {
  const [mounted, setMounted] = useState(false);
  const routeRef = useRef<SVGPathElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const planeRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Drive plane + trail from same JS animation loop
  useEffect(() => {
    const route = routeRef.current;
    const trail = trailRef.current;
    const plane = planeRef.current;
    if (!(route && trail && plane)) {
      return;
    }

    const totalLength = route.getTotalLength();
    trail.style.strokeDasharray = `${totalLength}`;
    trail.style.strokeDashoffset = `${totalLength}`;

    const duration = 4000; // ms
    const delay = 500; // ms
    let startTime: number | null = null;
    let rafId: number;

    const animate = (timestamp: number) => {
      startTime ??= timestamp;
      const elapsed = timestamp - startTime - delay;

      if (elapsed < 0) {
        rafId = requestAnimationFrame(animate);
        return;
      }

      const linearProgress = Math.min(elapsed / duration, 1);
      const easedProgress = cubicBezier(linearProgress, 0.25, 0.1, 0.25, 1);
      const currentLength = easedProgress * totalLength;

      // Trail: reveal up to currentLength
      trail.style.strokeDashoffset = `${totalLength - currentLength}`;

      // Plane: position + rotation along path
      const point = route.getPointAtLength(currentLength);
      const nearby =
        currentLength < totalLength - 1
          ? route.getPointAtLength(currentLength + 1)
          : route.getPointAtLength(currentLength - 1);
      const sign = currentLength < totalLength - 1 ? 1 : -1;
      const angle =
        Math.atan2(sign * (nearby.y - point.y), sign * (nearby.x - point.x)) *
        (180 / Math.PI);

      plane.setAttribute(
        "transform",
        `translate(${point.x}, ${point.y}) rotate(${angle})`
      );
      plane.style.opacity = "1";

      if (linearProgress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "absolute inset-0 size-full transition-opacity duration-1000",
        mounted ? "opacity-100" : "opacity-0",
        className
      )}
      fill="none"
      viewBox="0 0 1400 600"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Dashed route -- the planned path, visible immediately at low opacity */}
      <path
        d={FLIGHT_PATH}
        fill="none"
        opacity="0.3"
        ref={routeRef}
        stroke="url(#flightGradient)"
        strokeDasharray="8 6"
        strokeWidth="1.5"
      />

      {/* Solid trail -- drawn in by JS in sync with the plane */}
      <path
        d={FLIGHT_PATH}
        fill="none"
        ref={trailRef}
        stroke="url(#flightGradient)"
        strokeLinecap="round"
        strokeWidth="2"
      />

      {/* Departure dot */}
      <circle className="fill-fd-primary/60" cx="100" cy="480" r="5" />
      <circle className="fill-fd-primary/15" cx="100" cy="480" r="10" />

      {/* Arrival dot (pulsing) */}
      <circle
        className="flight-dot-pulse fill-fd-primary"
        cx="1300"
        cy="120"
        r="5"
      />
      <circle
        className="flight-dot-pulse fill-fd-primary/15"
        cx="1300"
        cy="120"
        r="12"
      />

      {/* Airplane -- positioned by JS, rotated to face direction of travel */}
      <g ref={planeRef} style={{ opacity: 0 }}>
        <path
          className="fill-fd-primary"
          d="M0 -10 L2 -8 L2 -3 L8 2 L8 4 L2 1 L2 5 L4 7 L4 8.5 L0 7 L-4 8.5 L-4 7 L-2 5 L-2 1 L-8 4 L-8 2 L-2 -3 L-2 -8 Z"
          transform="scale(1.4) rotate(90)"
        />
      </g>

      <defs>
        <linearGradient id="flightGradient" x1="0%" x2="100%" y1="0%" y2="0%">
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
function CopyButton({
  text,
  className,
}: Readonly<{ text: string; className?: string }>) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md border bg-fd-secondary px-2 py-1 text-fd-muted-foreground text-xs transition-colors hover:bg-fd-accent hover:text-fd-foreground",
        className ?? ""
      )}
      onClick={handleCopy}
      title="Copy to clipboard"
      type="button"
    >
      {copied ? (
        <svg
          aria-hidden="true"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

// Install command with typewriter on first view, then static + copy button
const INSTALL_CMD =
  "bash <(curl -o- https://raw.githubusercontent.com/JohanOhly/AirTrail/main/scripts/install.sh)";

export function InstallCommand() {
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [tick, setTick] = useState(0);
  const finished = tick >= INSTALL_CMD.length;

  // Start typing once visible
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.unobserve(element);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Typewriter tick
  useEffect(() => {
    if (!started || finished) {
      return;
    }
    const timer = setInterval(() => setTick((prev) => prev + 1), 35);
    return () => clearInterval(timer);
  }, [started, finished]);

  return (
    <div className="relative mt-6 w-full" ref={ref}>
      <pre className="overflow-x-auto rounded-xl border bg-fd-card text-sm shadow-lg">
        <div className="flex flex-row items-center gap-2 border-b px-4 py-2.5 text-fd-muted-foreground">
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" x2="20" y1="19" y2="19" />
          </svg>
          <span className="font-medium text-xs uppercase tracking-wide">
            Terminal
          </span>
          <div className="grow" />
          <CopyButton text={INSTALL_CMD} />
        </div>
        <code className="block p-4 text-fd-foreground">
          <span className="select-none text-fd-primary">$ </span>
          {started ? INSTALL_CMD.slice(0, tick) : ""}
          {started && !finished && (
            <span className="inline-block h-4 w-[2px] animate-pulse bg-fd-primary align-middle" />
          )}
        </code>
      </pre>
    </div>
  );
}

// Inline copy for a URL string
export function CopyableUrl({ url }: Readonly<{ url: string }>) {
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
}: Readonly<{
  children: ReactNode;
  className?: string;
  delay?: number;
}>) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(element);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn(
        "transition-all duration-700 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        className
      )}
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// Lightbox overlay for enlarged image
function ImageLightbox({ onClose }: Readonly<{ onClose: () => void }>) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <button
      aria-label="Close screenshot"
      className="lightbox-overlay fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-4 backdrop-blur-sm md:p-8"
      onClick={onClose}
      type="button"
    >
      <img
        alt="AirTrail screenshot"
        className="lightbox-image hidden max-h-[90vh] max-w-full rounded-lg shadow-2xl dark:block"
        height={1295}
        src="/dark.png"
        width={2560}
      />
      <img
        alt="AirTrail screenshot"
        className="lightbox-image max-h-[90vh] max-w-full rounded-lg shadow-2xl dark:hidden"
        height={1295}
        src="/light.png"
        width={2560}
      />
    </button>
  );
}

// Preview image (mobile full-width) -- click to enlarge
export function PreviewImage(props: Readonly<ComponentProps<"button">>) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <button
        {...props}
        aria-label="Enlarge screenshot"
        className={cn(
          "relative block w-full cursor-zoom-in overflow-hidden rounded-xl border shadow-2xl",
          props.className ?? ""
        )}
        onClick={() => setLightboxOpen(true)}
        type="button"
      >
        <img
          alt="AirTrail screenshot"
          className="hidden w-full dark:block"
          height={1295}
          src="/dark.png"
          width={2560}
        />
        <img
          alt="AirTrail screenshot"
          className="w-full dark:hidden"
          height={1295}
          src="/light.png"
          width={2560}
        />
      </button>
      {lightboxOpen ? (
        <ImageLightbox onClose={() => setLightboxOpen(false)} />
      ) : null}
    </>
  );
}

// Hero image (desktop, absolute-positioned in hero) -- click to enlarge
export function HeroImage({ className }: Readonly<{ className?: string }>) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Enlarge screenshot"
        className={cn("pointer-events-auto cursor-zoom-in", className ?? "")}
        onClick={() => setLightboxOpen(true)}
        type="button"
      >
        <img
          alt="AirTrail preview"
          className="hidden rounded-xl border shadow-2xl dark:block"
          height={1295}
          src="/dark.png"
          width={2560}
        />
        <img
          alt="AirTrail preview"
          className="rounded-xl border shadow-2xl dark:hidden"
          height={1295}
          src="/light.png"
          width={2560}
        />
      </button>
      {lightboxOpen ? (
        <ImageLightbox onClose={() => setLightboxOpen(false)} />
      ) : null}
    </>
  );
}
