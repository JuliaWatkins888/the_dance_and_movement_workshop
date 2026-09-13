import { useEffect, useState } from 'react';
import { Box, IconButton, ListRow, Pagination, SearchFilterBar, Text, dialog } from '@inithium/ui';
import { useListPagesQuery } from '@inithium/api-client';
import type { PageSearchField } from '@inithium/api-client';
import type { PageEntity } from '@inithium/db';
import { PageEditDialog } from './PageEditDialog';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const FIELD_OPTIONS: { value: PageSearchField; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'slug', label: 'Slug' },
  { value: 'routePattern', label: 'Route' },
];

// Pages are created/deleted by the developer (each corresponds to a real component that only
// takes effect through a build+deploy) - this module deliberately has no Add or Delete affordance
// anywhere, only search/list/edit of a page's own metadata (route, colors, animation, nav,
// access, SEO), all of which is served fresh from Mongo on every request and takes effect
// instantly with no rebuild.
export const PagesModule = () => {
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState<PageSearchField>('title');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, searchField]);

  const { data, isLoading, refetch } = useListPagesQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    searchField,
  });

  const openEditDialog = (pageEntity: PageEntity) => {
    const id = dialog.show(
      () => (
        <PageEditDialog
          page={pageEntity}
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: `Edit "${pageEntity.title}"`, width: 640 },
    );
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Text textColor={{ color: 'surface', intensity: 950 }} as="h1" className="text-2xl font-bold">
        Pages
      </Text>

      <SearchFilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchField={searchField}
        onSearchFieldChange={(value) => setSearchField(value as PageSearchField)}
        fieldOptions={FIELD_OPTIONS}
        placeholder="Search pages..."
      />

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <Box padding={{ base: 24 }}>
            <Text as="p" className="text-surface-500">
              Loading pages...
            </Text>
          </Box>
        ) : data && data.items.length > 0 ? (
          data.items.map((pageEntity) => (
            <ListRow
              key={pageEntity.id}
              trailing={
                <IconButton
                  icon="PencilSimple"
                  label={`Edit ${pageEntity.title}`}
                  onClick={() => openEditDialog(pageEntity)}
                />
              }
            >
              <Text textColor={{ color: 'surface', intensity: 950 }} as="span" className="font-medium">
                {pageEntity.title}
              </Text>
              <Text as="span" className="text-sm text-surface-600">
                {pageEntity.routePattern} · {pageEntity.layoutTemplate} ·{' '}
                {pageEntity.isPublished ? 'Published' : 'Unpublished'}
              </Text>
            </ListRow>
          ))
        ) : (
          <Box padding={{ base: 24 }}>
            <Text as="p" className="text-surface-500">
              No pages found.
            </Text>
          </Box>
        )}
      </Box>

      {data && data.totalPages > 1 ? (
        <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
      ) : null}
    </Box>
  );
};
