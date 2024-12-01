import { loader } from 'fumadocs-core/source';
import { createMDXSource } from 'fumadocs-mdx';
import { attachFile, createOpenAPI } from 'fumadocs-openapi/server';

import { docs, meta } from '@/.source';

export const openapi = createOpenAPI();

export const source = loader({
  baseUrl: '/docs',
  source: createMDXSource(docs, meta),
  pageTree: {
    attachFile,
  },
});
