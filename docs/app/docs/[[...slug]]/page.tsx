import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  PageLastUpdate,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/notebook/page";
import defaultMdxComponents, { createRelativeLink } from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ComponentProps } from "react";

import { OpenAPIPage } from "@/components/api-page";
import { Screenshot } from "@/components/screenshot";
import { getPageMarkdownUrl, gitConfig } from "@/lib/shared";
import { source } from "@/lib/source";

/*
 * The install methods are alternatives, so each one continues to
 * post-installation instead of to the next method in the sidebar.
 */
const installFooter = {
  items: {
    next: { name: "Post Installation", url: "/docs/install/post-installation" },
    previous: { name: "Requirements", url: "/docs/install/requirements" },
  },
};
const customFooters: Record<string, typeof installFooter> = {
  "install/docker-compose.mdx": installFooter,
  "install/manual.mdx": installFooter,
  "install/one-click.mdx": installFooter,
  "install/portainer.mdx": installFooter,
  "install/synology.mdx": installFooter,
};

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  if (page.type === "openapi") {
    return (
      <DocsPage full toc={page.data.toc}>
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsBody>
          <OpenAPIPage {...page.data.getOpenAPIPageProps()} />
        </DocsBody>
      </DocsPage>
    );
  }

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;

  return (
    <DocsPage
      footer={customFooters[page.path]}
      full={page.data.full}
      tableOfContent={{ single: false, style: "clerk" }}
      toc={page.data.toc}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">
        {page.data.description}
      </DocsDescription>
      <div className="flex flex-row items-center gap-2 border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/docs/content/docs/${page.path}`}
          markdownUrl={markdownUrl}
        />
      </div>
      <DocsBody>
        <MDX
          components={{
            ...defaultMdxComponents,
            a: createRelativeLink(source, page),
            Callout,
            Card,
            Cards,
            img: (imageProps) => (
              <ImageZoom
                {...(imageProps as ComponentProps<typeof ImageZoom>)}
              />
            ),
            Screenshot,
          }}
        />
      </DocsBody>
      {page.data.lastModified ? (
        <PageLastUpdate date={page.data.lastModified} />
      ) : null}
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(
  props: PageProps<"/docs/[[...slug]]">
): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  return {
    description: page.data.description,
    title: page.data.title,
  };
}
