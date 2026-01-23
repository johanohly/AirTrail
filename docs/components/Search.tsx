'use client';

import { liteClient } from 'algoliasearch/lite';
import { useDocsSearch } from 'fumadocs-core/search/client';
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
} from 'fumadocs-ui/components/dialog/search';
import posthog from 'posthog-js';
import { useCallback, useRef } from 'react';

const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const apiKey = process.env.NEXT_PUBLIC_ALGOLIA_API_KEY;
const indexName = process.env.NEXT_PUBLIC_ALGOLIA_INDEX;

if (!(appId && apiKey && indexName)) {
  throw new Error('Algolia credentials');
}

const client = liteClient(appId, apiKey);

export default function CustomSearchDialog(props: SharedProps) {
  const { search, setSearch, query } = useDocsSearch({
    type: 'algolia',
    client,
    indexName: indexName!,
  });

  // Track search with debounce to avoid excessive events
  const lastSearchRef = useRef<string>('');
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      // Only track when there's a meaningful search query (3+ chars)
      if (value.length >= 3 && value !== lastSearchRef.current) {
        lastSearchRef.current = value;
        posthog.capture('search_performed', {
          search_query: value,
          result_count: query.data !== 'empty' ? (query.data?.length ?? 0) : 0,
        });
      }
    },
    [setSearch, query.data],
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
        <SearchDialogList items={query.data !== 'empty' ? query.data : null} />
      </SearchDialogContent>
    </SearchDialog>
  );
}
