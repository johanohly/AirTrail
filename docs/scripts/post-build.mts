import * as fs from "node:fs";
import env from "@next/env";
import { algoliasearch } from "algoliasearch";
import { sync } from "fumadocs-core/search/algolia";

env.loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const indexPath = fs.existsSync(".next/server/app/static.json.body")
    ? ".next/server/app/static.json.body"
    : "out/static.json";
  const content = fs.readFileSync(indexPath);
  const indexes = JSON.parse(content.toString());

  const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
  const apiKey = process.env.ALGOLIA_API_KEY;
  const indexName = process.env.NEXT_PUBLIC_ALGOLIA_INDEX ?? "document";

  if (!(appId && apiKey)) {
    throw new Error("NEXT_PUBLIC_ALGOLIA_APP_ID, ALGOLIA_API_KEY are required");
  }

  const client = algoliasearch(appId, apiKey);

  await sync(client, {
    indexName,
    documents: indexes,
  });

  console.log(`Synced ${indexes.length} docs to Algolia index "${indexName}"`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
