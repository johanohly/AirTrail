import { loader } from "fumadocs-core/source";
import { createMDXSource } from "fumadocs-mdx";
import { createOpenAPI, transformerOpenAPI } from "fumadocs-openapi/server";

import { docs, meta } from "@/.source";

export const openapi = createOpenAPI();

export const source = loader({
  baseUrl: "/docs",
  source: createMDXSource(docs, meta),
  pageTree: {
    transformers: [transformerOpenAPI()],
  },
});
