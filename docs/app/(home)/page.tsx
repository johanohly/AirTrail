'use client';

import { Card, Cards } from 'fumadocs-ui/components/card';
import {
  ChartPie,
  CloudDownload,
  Globe,
  History,
  Map,
  Moon,
  Plane,
  Shield,
  TabletSmartphone,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import posthog from 'posthog-js';
import type React from 'react';
import Aurora from '@/components/Aurora';
import {
  FlightPath,
  InstallAnimation,
  FadeInOnScroll,
  PreviewImage,
  HeroImage,
} from './page.client';

export default function HomePage() {
  return (
    <div className="landing-page">
      {/* ── Hero Section ── */}
      <section className="hero-wrapper relative mb-16 lg:mb-24">
        <div className="hero-container relative flex min-h-[560px] items-end rounded-2xl border bg-fd-card md:min-h-[640px] lg:min-h-[700px]">
          <FlightPath className="pointer-events-none z-[1] opacity-60 dark:opacity-40" />

          {/* Subtle grid overlay */}
          <div className="hero-grid-overlay pointer-events-none absolute inset-0 z-[0] rounded-2xl" />

          {/* Content -- constrained to left half on lg+ to avoid overlapping the image */}
          <div className="relative z-[2] flex w-full flex-col p-6 md:p-10 lg:w-[50%] lg:p-14">
            <p className="landing-pill mb-6 w-fit rounded-full border border-fd-primary/30 px-3 py-1.5 font-medium text-fd-primary text-xs tracking-wide">
              Open-source flight tracker
            </p>
            <h1 className="mb-4 font-semibold text-3xl leading-[1.1] tracking-tight md:text-5xl xl:text-6xl">
              Your flights.
              <br />
              Your <span className="text-fd-primary">story</span>.
            </h1>
            <p className="mb-8 text-fd-muted-foreground text-sm leading-relaxed md:text-base">
              A modern, self-hosted personal flight tracking system. Map every
              journey, analyze your travel patterns, and own your data.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                className="landing-btn-primary inline-flex h-11 items-center justify-center rounded-full bg-fd-primary px-6 font-medium text-sm text-white tracking-tight transition-all hover:brightness-110 hover:shadow-lg hover:shadow-fd-primary/25"
                href="/docs/overview/introduction"
                onClick={() =>
                  posthog.capture('cta_clicked', {
                    cta_type: 'get_started',
                    location: 'homepage_hero',
                  })
                }
              >
                Get Started
              </Link>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-full border bg-fd-secondary px-6 font-medium text-fd-secondary-foreground text-sm tracking-tight transition-colors hover:bg-fd-accent"
                href="https://demo.airtrail.johan.ohly.dk"
                rel="noopener noreferrer"
                target="_blank"
                onClick={() =>
                  posthog.capture('demo_link_clicked', {
                    location: 'homepage_hero',
                  })
                }
              >
                Live Demo
              </Link>
            </div>
          </div>
        </div>

        {/* Hero preview image -- overflows the card on desktop */}
        <HeroImage className="absolute right-6 -bottom-12 z-[3] hidden w-[50%] lg:block xl:right-10 xl:-bottom-16" />
      </section>

      {/* Mobile-only preview image */}
      <div className="mt-8 lg:hidden">
        <PreviewImage />
      </div>

      {/* ── Intro Text ── */}
      <section className="mt-16 md:mt-24">
        <p className="mx-auto max-w-3xl text-center font-light text-xl leading-snug tracking-tight md:text-2xl xl:text-3xl">
          AirTrail gives you a{' '}
          <span className="font-medium text-fd-primary">
            beautiful world map
          </span>{' '}
          of every flight you&apos;ve taken, detailed{' '}
          <span className="font-medium text-fd-primary">statistics</span>, and
          full control over{' '}
          <span className="font-medium text-fd-primary">your data</span> &mdash;
          all self-hosted with Docker.
        </p>
      </section>

      {/* ── Features Grid ── */}
      <section className="mt-16 grid grid-cols-1 gap-5 md:mt-24 lg:grid-cols-2">
        <FadeInOnScroll>
          <h2 className="col-span-full mb-2 text-center font-medium text-2xl tracking-tight text-fd-primary lg:text-3xl">
            Everything you need.
          </h2>
          <p className="col-span-full mb-8 text-center text-fd-muted-foreground text-sm">
            Built for aviation enthusiasts who care about their data.
          </p>
        </FadeInOnScroll>

        <FadeInOnScroll delay={0} className="h-full">
          <FeatureCard
            icon={<Map className="size-5" />}
            title="Interactive World Map"
            description="Visualize every flight on an interactive globe. See your routes, airports, and travel patterns come alive."
          />
        </FadeInOnScroll>

        <FadeInOnScroll delay={100} className="h-full">
          <FeatureCard
            icon={<ChartPie className="size-5" />}
            title="Rich Statistics"
            description="Distance traveled, time in the air, airports visited, airline breakdowns -- deep insights into your flying history."
            variant="accent"
          />
        </FadeInOnScroll>

        <FadeInOnScroll delay={200} className="h-full">
          <FeatureCard
            icon={<CloudDownload className="size-5" />}
            title="Import From Anywhere"
            description="Bring in flights from MyFlightRadar24, App in the Air, JetLog, TripIt, Flighty, byAir, and more."
            variant="accent"
          />
        </FadeInOnScroll>

        <FadeInOnScroll delay={300} className="h-full">
          <FeatureCard
            icon={<Users className="size-5" />}
            title="Multi-User & Auth"
            description="Multiple users, shared flights, built-in authentication and OAuth support to secure your data."
          />
        </FadeInOnScroll>

        <FadeInOnScroll delay={150} className="h-full">
          <FeatureCard
            icon={<History className="size-5" />}
            title="Complete Flight History"
            description="Every departure, every arrival. Searchable, filterable, and always at your fingertips."
          />
        </FadeInOnScroll>

        <FadeInOnScroll delay={250} className="h-full">
          <FeatureCard
            icon={<Moon className="size-5" />}
            title="Light & Dark Modes"
            description="Easy on the eyes at any hour. Automatically adapts or lets you choose your preferred theme."
          />
        </FadeInOnScroll>
      </section>

      {/* ── Aurora Divider ── */}
      <section className="relative mt-16 md:mt-24">
        <div className="aurora-section relative overflow-hidden rounded-2xl border bg-fd-card">
          <Aurora bands={30} />
          <div className="relative z-10 flex flex-col items-center px-6 py-20 text-center md:py-28">
            <Plane className="mb-4 size-8 text-fd-primary" />
            <h2 className="mb-3 font-semibold text-2xl tracking-tight md:text-3xl">
              Self-hosted. Privacy-first.
            </h2>
            <p className="max-w-lg text-fd-muted-foreground text-sm leading-relaxed md:text-base">
              Your flight data stays on your server. No third-party tracking, no
              vendor lock-in. Deploy with Docker in minutes and own everything.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex h-10 items-center justify-center rounded-full bg-fd-primary px-5 font-medium text-sm text-white tracking-tight transition-all hover:brightness-110"
                href="/docs/overview/quick-start"
              >
                Quick Start Guide
              </Link>
              <Link
                className="inline-flex h-10 items-center justify-center rounded-full border bg-fd-secondary px-5 font-medium text-fd-secondary-foreground text-sm tracking-tight transition-colors hover:bg-fd-accent"
                href="https://github.com/JohanOhly/AirTrail"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Install Section ── */}
      <section className="mt-16 grid grid-cols-1 gap-5 md:mt-24 lg:grid-cols-2">
        <div className="col-span-full">
          <FadeInOnScroll>
            <h2 className="mb-2 text-center font-medium text-2xl tracking-tight text-fd-primary lg:text-3xl">
              Up and running in seconds.
            </h2>
            <p className="mb-6 text-center text-fd-muted-foreground text-sm">
              One command. That&apos;s all it takes.
            </p>
          </FadeInOnScroll>
        </div>

        <div className="col-span-full">
          <FadeInOnScroll>
            <div className="rounded-2xl border bg-fd-card p-6 shadow-lg md:p-8">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-fd-primary/10 text-fd-primary">
                  <Globe className="size-4" />
                </div>
                <span className="font-medium text-sm">
                  Run the installation script
                </span>
              </div>
              <p className="mb-1 text-fd-muted-foreground text-xs">
                Works on Linux systems with Docker preinstalled.
              </p>
              <InstallAnimation />
              <p className="mt-4 text-fd-muted-foreground text-xs">
                After installation, AirTrail will be available at{' '}
                <code className="rounded bg-fd-muted px-1.5 py-0.5 text-fd-foreground">
                  http://localhost:3000
                </code>
              </p>
            </div>
          </FadeInOnScroll>
        </div>

        <FadeInOnScroll delay={100}>
          <div className="landing-card flex h-full flex-col rounded-2xl border bg-fd-card p-6 shadow-lg">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-fd-primary/10 text-fd-primary">
                <Shield className="size-4" />
              </div>
              <span className="font-medium text-sm">Post-Installation</span>
            </div>
            <p className="mb-4 text-fd-muted-foreground text-xs leading-relaxed">
              Set up authentication, configure your instance, and start adding
              flights.
            </p>
            <div className="mt-auto">
              <Card
                href="/docs/install/post-installation"
                title="Post-installation guide"
              />
            </div>
          </div>
        </FadeInOnScroll>

        <FadeInOnScroll delay={200}>
          <div className="landing-card flex h-full flex-col rounded-2xl border bg-fd-card p-6 shadow-lg">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-fd-primary/10 text-fd-primary">
                <TabletSmartphone className="size-4" />
              </div>
              <span className="font-medium text-sm">
                Alternative Installation
              </span>
            </div>
            <p className="mb-4 text-fd-muted-foreground text-xs leading-relaxed">
              Prefer Docker Compose or need a custom setup? We have guides for
              every scenario.
            </p>
            <div className="mt-auto">
              <Cards>
                <Card
                  description="Step-by-step Docker Compose setup"
                  href="/docs/install/docker-compose"
                  title="Docker Compose"
                />
                <Card
                  description="All installation options"
                  href="/docs/overview/quick-start"
                  title="All Guides"
                />
              </Cards>
            </div>
          </div>
        </FadeInOnScroll>
      </section>
    </div>
  );
}

// ── Feature Card Component ──

type FeatureCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  variant?: 'default' | 'accent';
};

function FeatureCard({
  icon,
  title,
  description,
  variant = 'default',
}: Readonly<FeatureCardProps>) {
  const isAccent = variant === 'accent';
  return (
    <div
      className={`landing-card flex h-full flex-col rounded-2xl border p-6 shadow-lg transition-shadow hover:shadow-xl ${
        isAccent
          ? 'landing-card-accent bg-fd-primary/[0.03] dark:bg-fd-primary/[0.06]'
          : 'bg-fd-card'
      }`}
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-fd-primary/10 text-fd-primary">
          {icon}
        </div>
        <h3 className="font-medium text-base tracking-tight">{title}</h3>
      </div>
      <p className="text-fd-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}
