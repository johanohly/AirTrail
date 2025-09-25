import { $ } from "bun";
import { generateFiles } from "fumadocs-openapi";

await $`rm -rf ./content/docs/api/**/*.mdx`.nothrow();
await generateFiles({
  input: ["./openapi.yaml"],
  output: "./content/docs/api",
  groupBy: "tag",
});
