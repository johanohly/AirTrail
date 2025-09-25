import { Card, Cards } from "fumadocs-ui/components/card";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import {
  ChartPie,
  CloudDownload,
  History,
  Map,
  Moon,
  TabletSmartphone,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type React from "react";
import Aurora from "@/components/Aurora";
import DarkImg from "@/public/dark.png";
import LightImg from "@/public/light.png";

export default function HomePage() {
  return (
    <>
      <Aurora bands={40} />
      <div className="flex flex-col pb-10 md:pb-40">
        <h1 className="relative mb-6 max-w-4xl text-left font-bold text-4xl text-zinc-700 md:text-7xl dark:text-zinc-100">
          Welcome to AirTrail
        </h1>
        <h2 className="relative mb-8 max-w-2xl text-left text-sm text-zinc-500 leading-loose tracking-wide antialiased sm:text-xl dark:text-zinc-300">
          A modern, open-source personal flight tracking system
        </h2>
        <div className="relative mb-4 flex w-full flex-col justify-center space-y-2 sm:flex-row sm:justify-start sm:space-x-4 sm:space-y-0">
          <Link
            className="group relative flex h-14 w-full cursor-pointer items-center justify-center space-x-2 rounded-2xl bg-fd-primary p-px px-4 py-2 text-center font-semibold text-sm text-white no-underline shadow-zinc-900 transition duration-200 hover:shadow-2xl sm:w-52"
            href="/docs/overview/introduction"
          >
            Get Started
          </Link>
          <Link
            className="flex h-14 w-full items-center justify-center rounded-2xl border border-transparent bg-white text-black text-sm shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] transition duration-200 hover:shadow-lg sm:w-52 dark:border-neutral-600 dark:bg-fd-card dark:text-white"
            href="https://github.com/johanohly/AirTrail"
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub
          </Link>
        </div>
      </div>
      <div className="pb-10 md:pb-40">
        <Image
          alt="AirTrail screenshot"
          className="hidden dark:block"
          src={DarkImg}
        />
        <Image
          alt="AirTrail screenshot"
          className="dark:hidden"
          src={LightImg}
        />
      </div>
      <div className="pb-10 md:pb-40">
        <FeaturesSection />
      </div>
      <div className="flex flex-col space-y-4">
        <h3 className="font-medium text-3xl">Install and get started now</h3>
        <div className="steps">
          <div className="step">
            <strong className="text-lg">Run the installation script</strong>
            <p className="text-muted-foreground">
              The installation script only works on Linux systems with Docker
              preinstalled.
            </p>
            <div className="my-4">
              <DynamicCodeBlock
                code={
                  "bash <(curl -o- https://raw.githubusercontent.com/JohanOhly/AirTrail/main/scripts/install.sh)"
                }
                lang="bash"
              />
            </div>
          </div>
          <div className="step mb-6">
            <strong className="text-lg">
              {" "}
              Visit your new AirTrail instance!{" "}
            </strong>
            <p className="text-muted-foreground">
              AirTrail will be available at{" "}
              <Link
                className="text-blue-500 underline"
                href={"http://localhost:3000"}
              >
                http://localhost:3000
              </Link>{" "}
              locally, at the address you specified during installation.
            </p>
          </div>
          <div className="step">
            <strong className="text-lg">
              Follow the post-installation guide
            </strong>
            <Card
              href="/docs/install/post-installation"
              title="Post-installation guide"
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
              description="Get started in minutes using Docker Compose"
              href="/docs/install/docker-compose"
              title="Docker Compose"
            />
            <Card
              description="See all installation guides"
              href="/docs/overview/quick-start"
              title="Other"
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
          description="View all your flights on an interactive world map."
          title="World Map"
        >
          <Map />
        </StaggerCard>
        <StaggerCard
          description="Keep track of all your flights in one place."
          title="Flight History"
        >
          <History />
        </StaggerCard>
        <StaggerCard
          description="Get insights into your flight history with statistics."
          title="Statistics"
        >
          <ChartPie />
        </StaggerCard>
        <StaggerCard
          description="Switch between light and dark mode."
          title="Dark Mode"
        >
          <Moon />
        </StaggerCard>
        <StaggerCard
          description="Manage multiple users, share flights among them, secure your data with user authentication and integrate with your OAuth provider."
          title="Multiple Users"
        >
          <Users />
        </StaggerCard>
        <StaggerCard
          description="Import flights from various sources including MyFlightRadar24, App in the Air and JetLog."
          title="Import Flights"
        >
          <CloudDownload />
        </StaggerCard>
        <StaggerCard
          description="Use the application on any device with a responsive design."
          title="Responsive Design"
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

type StaggerCardProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

function StaggerCard({
  title,
  description,
  children,
}: Readonly<StaggerCardProps>) {
  return (
    <div
      className="block rounded-lg border bg-fd-card text-fd-card-foreground shadow-md transition-colors"
      style={{ padding: "clamp(1rem,calc(.125rem + 3vw),2.5rem)" }}
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="not-prose w-fit rounded-md border bg-fd-muted p-1.5 text-fd-muted-foreground [&_svg]:size-5">
          {children}
        </div>
        <span className="font-medium text-xl">{title}</span>
      </div>
      {description}
    </div>
  );
}
