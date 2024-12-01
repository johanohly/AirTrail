import { Card, Cards } from 'fumadocs-ui/components/card';
import {
  ChartPie,
  CloudDownload,
  History,
  Map,
  Moon,
  TabletSmartphone,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

import Aurora from '@/components/Aurora';
import { CodeBlock } from '@/components/CodeBlock';
import DarkImg from '@/public/dark.png';
import LightImg from '@/public/light.png';

export default function HomePage() {
  return (
    <>
      <Aurora bands={40} />
      <div className="flex flex-col pb-10 md:pb-40">
        <h1 className="text-4xl md:text-7xl font-bold mb-6 relative text-left dark:text-zinc-100 text-zinc-700 max-w-4xl">
          Welcome to AirTrail
        </h1>
        <h2 className="relative text-sm sm:text-xl text-zinc-500 dark:text-zinc-300 tracking-wide mb-8 text-left max-w-2xl antialiased leading-loose">
          A modern, open-source personal flight tracking system
        </h2>
        <div className="flex relative sm:flex-row flex-col space-y-2 justify-center sm:space-y-0 sm:space-x-4 sm:justify-start mb-4 w-full">
          <Link
            className="bg-fd-primary no-underline flex space-x-2 group cursor-pointer relative hover:shadow-2xl transition duration-200 shadow-zinc-900 p-px font-semibold text-white px-4 py-2 w-full sm:w-52 h-14 rounded-2xl text-sm text-center items-center justify-center"
            href="/docs/overview/introduction"
          >
            Get Started
          </Link>
          <Link
            className="w-full sm:w-52 text-sm text-black bg-white dark:bg-fd-card h-14 border border-transparent  dark:text-white dark:border-neutral-600 flex justify-center items-center rounded-2xl hover:shadow-lg transition duration-200 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]"
            href="https://github.com/johanohly/AirTrail"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </Link>
        </div>
      </div>
      <div className="pb-10 md:pb-40">
        <Image
          src={DarkImg}
          className="hidden dark:block"
          alt="AirTrail screenshot"
        />
        <Image
          src={LightImg}
          className="dark:hidden"
          alt="AirTrail screenshot"
        />
      </div>
      <div className="pb-10 md:pb-40">
        <FeaturesSection />
      </div>
      <div className="flex flex-col space-y-4">
        <h3 className="text-3xl font-medium">Install and get started now</h3>
        <div className="steps">
          <div className="step">
            <strong className="text-lg">Run the installation script</strong>
            <p className="text-muted-foreground">
              The installation script only works on Linux systems with Docker
              preinstalled.
            </p>
            <CodeBlock
              lang="bash"
              code={`bash <(curl -o- https://raw.githubusercontent.com/JohanOhly/AirTrail/main/scripts/install.sh)`}
            />
          </div>
          <div className="step mb-6">
            <strong className="text-lg">
              {' '}
              Visit your new AirTrail instance!{' '}
            </strong>
            <p className="text-muted-foreground">
              AirTrail will be available at{' '}
              <Link
                className="underline text-blue-500"
                href={`http://localhost:3000`}
              >
                http://localhost:3000
              </Link>{' '}
              locally, at the address you specified during installation.
            </p>
          </div>
          <div className="step">
            <strong className="text-lg">
              Follow the post-installation guide
            </strong>
            <Card
              title="Post-installation guide"
              href="/docs/install/post-installation"
            />
          </div>
        </div>
        <div className="space-y-2">
          <p>
            If you are on an unsupported platform, or you prefer to do things
            yourself, you can follow the Docker Compose guide, which goes
            through the same steps as the installation script, but manually.
          </p>
          <Cards>
            <Card
              title="Docker Compose"
              description="Get started in minutes using Docker Compose"
              href="/docs/install/docker-compose"
            />
            <Card
              title="Other"
              description="See all installation guides"
              href="/docs/overview/quick-start"
            />
          </Cards>
        </div>
      </div>
    </>
  );
}

function FeaturesSection() {
  return (
    <>
      <div className="stagger not-prose">
        <StaggerCard
          title="World Map"
          description="View all your flights on an interactive world map."
        >
          <Map />
        </StaggerCard>
        <StaggerCard
          title="Flight History"
          description="Keep track of all your flights in one place."
        >
          <History />
        </StaggerCard>
        <StaggerCard
          title="Statistics"
          description="Get insights into your flight history with statistics."
        >
          <ChartPie />
        </StaggerCard>
        <StaggerCard
          title="Dark Mode"
          description="Switch between light and dark mode."
        >
          <Moon />
        </StaggerCard>
        <StaggerCard
          title="Multiple Users"
          description="Manage multiple users, share flights among them, secure your data with user authentication and integrate with your OAuth provider."
        >
          <Users />
        </StaggerCard>
        <StaggerCard
          title="Import Flights"
          description="Import flights from various sources including MyFlightRadar24, App in the Air and JetLog."
        >
          <CloudDownload />
        </StaggerCard>
        <StaggerCard
          title="Responsive Design"
          description="Use the application on any device with a responsive design."
        >
          <TabletSmartphone />
        </StaggerCard>
      </div>
      <style>
        {`
          .stagger {
            display: grid;
            grid-template-columns: 100%;
            gap: 1rem;
          }
          
          @media (min-width: 50rem) {
            .stagger {
              --stagger-height: 4rem;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 1.5rem;
            }
          }
          
          .stagger > :nth-child(2n) {
            transform: translateY(var(--stagger-height));
          }
        `}
      </style>
    </>
  );
}

interface StaggerCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function StaggerCard({ title, description, children }: StaggerCardProps) {
  return (
    <div
      className="block rounded-lg border bg-fd-card text-fd-card-foreground shadow-md transition-colors"
      style={{ padding: 'clamp(1rem,calc(.125rem + 3vw),2.5rem)' }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="not-prose w-fit rounded-md border bg-fd-muted p-1.5 text-fd-muted-foreground [&_svg]:size-5">
          {children}
        </div>
        <span className="text-xl font-medium">{title}</span>
      </div>
      {description}
    </div>
  );
}
