import { llms, loader } from "fumadocs-core/source";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { defineDocs } from "fumadocs-mdx/macro";

import { openapi } from "@/lib/openapi";

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    // From Git history, so deploys need a full (not shallow) clone.
    lastModified: true,
    postprocess: { includeProcessedMarkdown: true },
    schema: pageSchema,
  },
  meta: { schema: metaSchema },
});

/*
 * API reference pages are built from the OpenAPI documents at build time. Each
 * tag becomes a folder, and its pages are listed in the order the operations
 * appear in the spec. The order of the folders themselves is set in
 * content/docs/api/meta.json.
 */
const METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
];

/** operationId -> position, in the order operations appear in the specs. */
async function specOrder() {
  const order = new Map<string, number>();
  const schemas = await openapi.getSchemas();
  for (const { bundled } of Object.values(schemas)) {
    for (const item of Object.values(bundled.paths ?? {})) {
      for (const key of Object.keys(item ?? {})) {
        const operationId = METHODS.includes(key)
          ? (item as Record<string, { operationId?: string }>)[key]?.operationId
          : undefined;
        if (operationId) {
          order.set(operationId, order.size);
        }
      }
    }
  }
  return order;
}

const apiReference = await openapi.staticSource({
  baseDir: "api",
  groupBy: "tag",
  meta: true,
});
const order = await specOrder();
const position = (page: string) => order.get(page) ?? Number.MAX_SAFE_INTEGER;
apiReference.files = apiReference.files
  .filter((file) => !(file.type === "meta" && file.path === "api/meta.json"))
  .map((file) =>
    file.type === "meta" && file.data.pages
      ? {
          ...file,
          data: {
            ...file.data,
            pages: [...file.data.pages].sort(
              (a, b) => position(a) - position(b)
            ),
          },
        }
      : file
  );

export const source = loader(
  { docs: docs.toFumadocsSource(), openapi: apiReference },
  {
    baseUrl: "/docs",
    plugins: [openapi.loaderPlugin()],
  }
);

export const docsLlms = llms(source, {
  renderPage: async (page) => {
    if (page.type === "openapi") {
      return `# ${page.data.title} (${page.url})\n\n${page.data.description ?? ""}`;
    }
    return `# ${page.data.title} (${page.url})\n\n${await page.data.getText("processed")}`;
  },
});
