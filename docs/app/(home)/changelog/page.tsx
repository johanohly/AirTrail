import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Callout } from 'fumadocs-ui/components/callout';
import { type Jsx, toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { ExternalLink, ShieldAlert, Tag } from 'lucide-react';
import type { CSSProperties, JSX, ReactNode } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { remark } from 'remark';
import remarkRehype from 'remark-rehype';
import { z } from 'zod';

import {
  type GitHubAlertType,
  processReleaseBody,
  remarkGitHubAlerts,
} from '@/lib/changelog';

const REPO = 'johanohly/AirTrail';

const calloutConfig: Record<
  GitHubAlertType,
  { title: string; type: 'info' | 'success' | 'warning' | 'error' }
> = {
  note: { title: 'Note', type: 'info' },
  tip: { title: 'Tip', type: 'success' },
  important: { title: 'Important', type: 'info' },
  warning: { title: 'Warning', type: 'warning' },
  caution: { title: 'Caution', type: 'error' },
};

function GitHubAlert({
  alertType,
  children,
}: {
  alertType: GitHubAlertType;
  children?: ReactNode;
}) {
  const config = calloutConfig[alertType];
  const importantStyle =
    alertType === 'important'
      ? ({ '--callout-color': 'var(--color-purple-500)' } as CSSProperties)
      : undefined;

  return (
    <Callout
      type={config.type}
      title={config.title}
      icon={
        alertType === 'important' ? (
          <ShieldAlert className="size-5 shrink-0 text-(--callout-color)" />
        ) : undefined
      }
      style={importantStyle}
    >
      {children}
    </Callout>
  );
}

export default async function Changelog() {
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
  });
  const githubToken = process.env.GITHUB_TOKEN;

  const resp = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
    headers: {
      Accept: 'application/vnd.github+json',
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });
  const body = await resp.json();

  if (!resp.ok) {
    throw new Error(
      `GitHub releases request failed: ${resp.status} ${resp.statusText}`,
    );
  }

  const releases: {
    name: string;
    body: string;
    html_url: string;
    published_at: Date;
    bodyElement?: JSX.Element;
  }[] = z
    .object({
      name: z.string(),
      body: z.string(),
      html_url: z.string(),
      published_at: z.coerce.date(),
    })
    .array()
    .parse(body);

  const processor = remark().use(remarkGitHubAlerts).use(remarkRehype);
  const { img: _, ...comps } = defaultMdxComponents;

  for (const release of releases) {
    const processed = processReleaseBody(
      release.body.replaceAll("What's Changed", ''),
    );
    const nodes = processor.parse({ value: processed });
    const hast = await processor.run(nodes);
    release.bodyElement = toJsxRuntime(hast, {
      development: false,
      jsx: jsx as Jsx,
      jsxs: jsxs as Jsx,
      Fragment,
      components: {
        ...comps,
        'github-alert': GitHubAlert,
      },
    });
  }

  return (
    <div className="changelog-page mx-auto max-w-3xl">
      {/* Header */}
      <header className="mb-12">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-fd-primary/10 text-fd-primary">
            <Tag className="size-5" />
          </div>
          <h1 className="font-semibold text-3xl tracking-tight md:text-4xl">
            Changelog
          </h1>
        </div>
        <p className="max-w-lg text-fd-muted-foreground text-sm leading-relaxed md:text-base">
          New features, improvements, and fixes for every AirTrail release.
        </p>
      </header>

      {/* Timeline */}
      <div className="changelog-timeline relative">
        {/* Vertical line */}
        <div className="absolute top-2 bottom-0 left-[7px] w-px bg-fd-border" />

        {releases.map((release, i) => (
          <article
            key={release.html_url}
            className={`changelog-entry relative pb-12 pl-10 ${i === releases.length - 1 ? 'pb-0' : ''}`}
          >
            {/* Timeline dot */}
            <div
              className={`absolute left-0 top-1.5 size-[15px] rounded-full border-2 ${
                i === 0
                  ? 'border-fd-primary bg-fd-primary'
                  : 'border-fd-border bg-fd-background'
              }`}
            />

            {/* Date */}
            <time className="mb-2 block font-medium text-fd-muted-foreground text-xs tracking-wide">
              {formatter.format(release.published_at)}
            </time>

            {/* Release card */}
            <div className="rounded-xl border bg-fd-card p-5 shadow-sm transition-shadow hover:shadow-md md:p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <h2 className="font-semibold text-lg tracking-tight md:text-xl">
                  {release.name}
                </h2>
                <a
                  href={release.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1.5 rounded-full border bg-fd-secondary px-3 py-1 font-medium text-fd-muted-foreground text-xs transition-colors hover:bg-fd-accent hover:text-fd-foreground"
                >
                  GitHub
                  <ExternalLink className="size-3" />
                </a>
              </div>
              <div className="prose prose-sm max-w-none text-fd-foreground [&_a]:text-fd-primary [&_a]:no-underline [&_a:hover]:underline [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-medium [&_li]:text-sm [&_li]:text-fd-muted-foreground [&_p]:text-sm [&_p]:text-fd-muted-foreground [&_ul]:my-2">
                {release.bodyElement}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
