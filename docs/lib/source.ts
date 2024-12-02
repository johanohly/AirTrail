import { loader } from 'fumadocs-core/source';
import { createMDXSource } from 'fumadocs-mdx';
import { attachFile, createOpenAPI } from 'fumadocs-openapi/server';

import { docs, meta } from '@/.source';
import { createElement } from 'react';

export const openapi = createOpenAPI({
  renderer: {
    // Disable the API Playground for now
    // https://github.com/fuma-nama/fumadocs/issues/1131
    APIPlayground() {
      return createElement('div');
    }
  }
});

export const source = loader({
  baseUrl: '/docs',
  source: createMDXSource(docs, meta),
  pageTree: {
    attachFile,
  },
});
