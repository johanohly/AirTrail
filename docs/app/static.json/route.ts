import type { DocumentRecord } from "fumadocs-core/search/algolia";
import { NextResponse } from "next/server";
import { source, type DocsPageData } from "@/lib/source";

export const revalidate = false;

export function GET() {
  const results: DocumentRecord[] = [];

  for (const page of source.getPages()) {
    const data = page.data as DocsPageData;

    results.push({
      _id: page.url,
      structured: data.structuredData,
      url: page.url,
      title: data.title ?? page.url,
      description: data.description,
    });
  }

  return NextResponse.json(results);
}
