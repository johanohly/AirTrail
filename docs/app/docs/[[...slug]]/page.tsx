import { Callout } from 'fumadocs-ui/components/callout';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { ImageZoom } from 'fumadocs-ui/components/image-zoom';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { APIPage } from 'fumadocs-openapi/ui';
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';

import { openapi, source } from '@/lib/source';

const installFooter = {
  items: {
    previous: {
      name: 'Requirements',
      url: '/docs/install/requirements',
    },
    next: {
      name: 'Post-installation',
      url: '/docs/install/post-installation',
    },
  },
};
const customFooters: Record<
  string,
  {
    items: {
      previous?: { name: string; url: string };
      next?: { name: string; url: string };
    };
  }
> = {
  'install/docker-compose.mdx': installFooter,
  'install/one-click.mdx': installFooter,
  'install/portainer.mdx': installFooter,
  'install/synology.mdx': installFooter,
};

interface Props {
  params: Promise<{ slug?: string[] }>;
}

export default async function Page(props: Readonly<Props>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) return notFound();

  const path = page.file.path;
  const fullPath = `docs/content/docs/${path}`;
  const { body: Mdx, lastModified } = page.data;

  const footerOverride = customFooters?.[path] ?? undefined;

  return (
    <DocsPage
      toc={page.data.toc}
      tableOfContent={{
        style: 'clerk',
        single: false,
      }}
      full={page.data.full}
      editOnGithub={{
        repo: 'AirTrail',
        owner: 'johanohly',
        sha: 'main',
        path: fullPath,
      }}
      lastUpdate={lastModified}
      footer={footerOverride}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <Mdx
          components={{
            ...defaultMdxComponents,
            APIPage: (props) => <APIPage {...openapi.getAPIPageProps(props)} />,
            Callout,
            Card,
            Cards,
            // @ts-ignore
            img: (props) => <ImageZoom {...(props as any)} />,
          }}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) return notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
