import { readFileSync } from 'node:fs';
import path from 'node:path';

import env from '@next/env';
import algosearch from 'algoliasearch';
import { sync } from 'fumadocs-core/search/algolia';
import { createGetUrl, getSlugs, parseFilePath } from 'fumadocs-core/source';
import type { Manifest } from 'fumadocs-mdx';

env.loadEnvConfig(process.cwd());

const getUrl = createGetUrl('/');

async function main(): Promise<void> {
  const manifest = JSON.parse(
    readFileSync('.source/manifest.json').toString(),
  ) as Manifest;

  const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
  const apiKey = process.env.ALGOLIA_API_KEY;

  if (!appId || !apiKey) {
    throw new Error('NEXT_PUBLIC_ALGOLIA_APP_ID, ALGOLIA_API_KEY are required');
  }

  const client = algosearch(appId, apiKey);

  await sync(client, {
    document: process.env.NEXT_PUBLIC_ALGOLIA_INDEX ?? 'document',
    documents: manifest.files
      .filter((file) => file.collection === 'docs')
      .map((docs) => {
        const url = getUrl(
          getSlugs(parseFilePath(path.relative('content/docs/', docs.path))),
        );

        if (!docs.data.structuredData)
          throw new Error('`structuredData` is required');

        return {
          _id: url,
          title: docs.data.frontmatter.title as string,
          description: docs.data.frontmatter.description as string,
          url,
          structured: docs.data.structuredData,
        };
      }),
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
