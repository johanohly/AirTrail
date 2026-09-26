"use client";

import { useDocsSearch } from "fumadocs-core/search/client";
import { staticClient } from "fumadocs-core/search/client/orama-static";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import posthog from "posthog-js";
import { useCallback, useRef } from "react";

// The index is prerendered to /api/search at build time and searched in the browser.
const client = staticClient({});

export default function CustomSearchDialog(props: SharedProps) {
  const { search, setSearch, query } = useDocsSearch({ client });

  // Track search with debounce to avoid excessive events
  const lastSearchRef = useRef<string>("");
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      // Only track when there's a meaningful search query (3+ chars)
      if (value.length >= 3 && value !== lastSearchRef.current) {
        lastSearchRef.current = value;
        posthog.capture("search_performed", {
          result_count: query.data === "empty" ? 0 : (query.data?.length ?? 0),
          search_query: value,
        });
      }
    },
    [setSearch, query.data]
  );

  return (
    <SearchDialog
      isLoading={query.isLoading}
      onSearchChange={handleSearchChange}
      search={search}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data === "empty" ? null : query.data} />
      </SearchDialogContent>
    </SearchDialog>
  );
}
