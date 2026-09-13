import { useEffect, useState } from 'react';
import { Box, Button, IconButton, ListRow, Pagination, Pill, SearchFilterBar, Text, dialog, useSelection } from '@inithium/ui';
import { useDeleteGalleryImageMutation, useListGalleryImagesAdminQuery } from '@inithium/api-client';
import type { GalleryImageSearchField } from '@inithium/db';
import type { GalleryImageDto } from '@inithium/api-client';
import { GalleryImageEditDialog } from './GalleryImageEditDialog';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const DIALOG_WIDTH = 900;

const FIELD_OPTIONS: { value: GalleryImageSearchField; label: string }[] = [{ value: 'title', label: 'Title' }];

export const GalleryAdminModule = () => {
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState<GalleryImageSearchField>('title');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, searchField]);

  const { data, isLoading, refetch } = useListGalleryImagesAdminQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    searchField,
  });
  const [deleteGalleryImage] = useDeleteGalleryImageMutation();
  const selection = useSelection();

  const openCreateDialog = () => {
    const id = dialog.show(
      () => (
        <GalleryImageEditDialog
          mode="create"
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: 'New Image', width: DIALOG_WIDTH },
    );
  };

  const openEditDialog = (image: GalleryImageDto) => {
    const id = dialog.show(
      () => (
        <GalleryImageEditDialog
          mode="edit"
          initialImage={image}
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: `Edit "${image.title}"`, width: DIALOG_WIDTH },
    );
  };

  const handleDelete = async (image: GalleryImageDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this image?',
      description: `This will permanently delete "${image.title}" and its file. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await deleteGalleryImage(image.id).unwrap();
    refetch();
  };

  const handleBulkDelete = async () => {
    const confirmed = await dialog.confirm({
      title: `Delete ${selection.selectedCount} images?`,
      description: 'This will permanently delete every selected image and its file. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await Promise.all([...selection.selectedIds].map((id) => deleteGalleryImage(id).unwrap()));
    selection.clear();
    refetch();
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Gallery
        </Text>
        <Box flex={{ direction: 'row', align: 'center', gap: 12 }}>
          {selection.selectedCount >= 2 ? (
            <Button variant={{ kind: 'filled', color: 'red' }} onClick={handleBulkDelete}>
              Delete Selected ({selection.selectedCount})
            </Button>
          ) : null}
          <Button variant={{ kind: 'filled', color: 'primary' }} onClick={openCreateDialog}>
            New Image
          </Button>
        </Box>
      </Box>

      <SearchFilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchField={searchField}
        onSearchFieldChange={(value) => setSearchField(value as GalleryImageSearchField)}
        fieldOptions={FIELD_OPTIONS}
        placeholder="Search images..."
      />

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              Loading images...
            </Text>
          </Box>
        ) : data && data.items.length > 0 ? (
          data.items.map((image) => (
            <ListRow
              key={image.id}
              selected={selection.isSelected(image.id)}
              onSelectedChange={() => selection.toggle(image.id)}
              leading={<img src={image.url} alt="" className="h-12 w-12 rounded object-cover" />}
              trailing={
                <>
                  <IconButton icon="PencilSimple" label={`Edit ${image.title}`} onClick={() => openEditDialog(image)} />
                  <IconButton
                    icon="Trash"
                    label={`Delete ${image.title}`}
                    textColor={{ color: 'red', intensity: 600 }}
                    onClick={() => handleDelete(image)}
                  />
                </>
              }
            >
              <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
                <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
                  {image.title}
                </Text>
                <Pill color={image.isPublished ? { color: 'primary', intensity: 100 } : { color: 'surface', intensity: 200 }}>
                  {image.isPublished ? 'Published' : 'Draft'}
                </Pill>
                {image.sourceType === 'local' ? (
                  <Pill color={{ color: 'amber', intensity: 100 }}>Local - needs redeploy to persist</Pill>
                ) : null}
              </Box>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                {image.sourceType}
              </Text>
            </ListRow>
          ))
        ) : (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              No images found.
            </Text>
          </Box>
        )}
      </Box>

      {data && data.totalPages > 1 ? <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};
