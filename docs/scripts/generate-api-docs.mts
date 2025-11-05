import { $ } from "bun";
import { generateFiles } from "fumadocs-openapi";
import { openapi } from "@/lib/source";

await $`rm -rf ./content/docs/api/**/*.mdx`.nothrow();
await generateFiles({
  input: openapi,
  output: "./content/docs/api",
  groupBy: "tag",
  includeDescription: true,
});
