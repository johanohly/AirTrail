import { loader } from "fumadocs-core/source";
import type { DocData } from "fumadocs-mdx";
import { createOpenAPI, openapiPlugin } from "fumadocs-openapi/server";
import { docs } from "@/.source";

export type DocsPageData = DocData & {
  full?: boolean;
  title?: string;
  description?: string;
};

export const openapi = createOpenAPI({
  input: ["./openapi.yaml"],
});

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  plugins: [openapiPlugin()],
});
