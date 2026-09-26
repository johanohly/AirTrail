import { createGetUrl } from "fumadocs-core/source";

export const docsContentRoute = "/llms.mdx/docs";

export const gitConfig = {
  branch: "main",
  repo: "AirTrail",
  user: "johanohly",
};

const getContentUrl = createGetUrl(docsContentRoute);

/** The URL of a page's Markdown, served for LLMs and the copy button. */
export function getPageMarkdownUrl(page: { slugs: string[] }) {
  const segments = [...page.slugs, "content.md"];
  return { segments, url: getContentUrl(segments) };
}
