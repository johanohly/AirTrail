import type { Blockquote, Parent, Root, Text } from 'mdast';

export const githubAlertTypes = [
  'note',
  'tip',
  'important',
  'warning',
  'caution',
] as const;

export type GitHubAlertType = (typeof githubAlertTypes)[number];

const githubAlertTypeSet = new Set<string>(githubAlertTypes);

/**
 * Makes GitHub-generated release links compact without changing their target.
 */
export function processReleaseBody(body: string): string {
  let result = body;

  // Markdown compare links whose label repeats the full URL -> [`v1...v2`](url)
  result = result.replaceAll(
    /\[(https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/compare\/([^\]\s]+))\]\(\1\)/g,
    (_match, url: string, range: string) => `[\`${range}\`](${url})`,
  );

  // Bare PR / issue URLs -> [#number](url)
  result = result.replaceAll(
    /(?<!\]\()https:\/\/github\.com\/[^/]+\/[^/]+\/(?:pull|issues)\/(\d+)/g,
    (url, num) => `[#${num}](${url})`,
  );

  // Bare compare URLs -> [`v1...v2`](url)
  result = result.replaceAll(
    /(?<!\]\()https:\/\/github\.com\/[^/]+\/[^/]+\/compare\/([^\s)]+)/g,
    (url, range) => `[\`${range}\`](${url})`,
  );

  // Bare user profile URLs -> [@username](url)
  result = result.replaceAll(
    /(?<!\]\()https:\/\/github\.com\/([a-zA-Z0-9-]+)(?=[)\s,]|$)/g,
    (url, username) => `[@${username}](${url})`,
  );

  return result;
}

type BlockquoteData = NonNullable<Blockquote['data']> & {
  hName?: string;
  hProperties?: { alertType: GitHubAlertType };
};

function visitGitHubAlerts(node: Root | Parent): void {
  for (const child of node.children) {
    if (child.type === 'blockquote') {
      const firstParagraph = child.children[0];

      if (firstParagraph?.type === 'paragraph') {
        const firstText = firstParagraph.children[0];

        if (firstText?.type !== 'text') continue;

        const match = firstText.value.match(/^\[!(\w+)\](?:\r?\n)?/);
        const alertType = match?.[1].toLowerCase();

        if (match && alertType && githubAlertTypeSet.has(alertType)) {
          firstText.value = firstText.value.slice(match[0].length);
          const data = (child.data ?? {}) as BlockquoteData;
          data.hName = 'github-alert';
          data.hProperties = { alertType: alertType as GitHubAlertType };
          child.data = data;
        }
      }
    }

    if ('children' in child) {
      visitGitHubAlerts(child as Parent);
    }
  }
}

/** Turns GitHub alert blockquotes into a custom HAST element for React. */
export function remarkGitHubAlerts() {
  return (tree: Root) => visitGitHubAlerts(tree);
}
