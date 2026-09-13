import { useEffect, useState } from 'react';
import { Box, Button, IconButton, Loader, Text, dialog } from '@inithium/ui';
import { useListPublishedGalleryImagesQuery } from '@inithium/api-client';
import type { GalleryImageDto } from '@inithium/api-client';

const PAGE_SIZE = 20;

interface GalleryLightboxProps {
  readonly images: readonly GalleryImageDto[];
  readonly initialIndex: number;
}

// Local to this file, same convention as the storage plugin's own AssetLightbox (profile Assets
// tab) - this extends that pattern with the description slot that one lacks, since the gallery
// requirement is explicit about showing an image's description when it's open large.
const GalleryLightbox = ({ images, initialIndex }: GalleryLightboxProps) => {
  const [index, setIndex] = useState(initialIndex);
  const image = images[index]!;
  const hasMultiple = images.length > 1;

  const goToPrevious = () => setIndex((current) => (current - 1 + images.length) % images.length);
  const goToNext = () => setIndex((current) => (current + 1) % images.length);

  return (
    <Box flex={{ direction: 'col', gap: 12 }}>
      <Box flex={{ direction: 'row', align: 'center', justify: 'center', gap: 16 }}>
        {hasMultiple ? <IconButton icon="CaretLeft" label="Previous image" onClick={goToPrevious} /> : null}
        <img src={image.url} alt={image.altText ?? ''} className="max-h-[70vh] max-w-full rounded object-contain" />
        {hasMultiple ? <IconButton icon="CaretRight" label="Next image" onClick={goToNext} /> : null}
      </Box>
      <Box flex={{ direction: 'col', gap: 4 }} padding={{ left: 8, right: 8 }}>
        <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-semibold">
          {image.title}
        </Text>
        {image.description ? (
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
            {image.description}
          </Text>
        ) : null}
      </Box>
    </Box>
  );
};

export const GalleryPage = () => {
  const [page, setPage] = useState(1);
  const [images, setImages] = useState<GalleryImageDto[]>([]);
  const { data, isLoading } = useListPublishedGalleryImagesQuery({ page, pageSize: PAGE_SIZE });

  // Appends rather than replaces on page change - see the "Load more" button below for why a
  // masonry grid can't use the codebase's usual Pagination composite (a full replace re-flows
  // every column and resets scroll, which reads as a jarring "everything jumped" moment on an
  // image-heavy grid in a way it doesn't for a plain card grid like BlogIndexPage's own).
  useEffect(() => {
    if (!data) return;
    setImages((current) => (page === 1 ? data.items : [...current, ...data.items]));
  }, [data, page]);

  const openLightbox = (index: number) => {
    dialog.show(() => <GalleryLightbox images={images} initialIndex={index} />, { title: 'Photo', width: '75vw' });
  };

  const hasMore = Boolean(data && page < data.totalPages);

  return (
    <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }}>
      <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-3xl font-bold">
        Gallery
      </Text>

      {isLoading && images.length === 0 ? (
        <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
          <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
        </Box>
      ) : images.length === 0 ? (
        <Text textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          No images yet.
        </Text>
      ) : (
        <Box className="columns-2 gap-4 sm:columns-3 lg:columns-4">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              className="mb-4 block w-full cursor-pointer break-inside-avoid"
              onClick={() => openLightbox(index)}
            >
              <img src={image.url} alt={image.altText ?? ''} className="w-full rounded-md object-cover" />
            </button>
          ))}
        </Box>
      )}

      {hasMore ? (
        <Box flex={{ justify: 'center' }}>
          <Button variant={{ kind: 'outlined', color: 'primary' }} onClick={() => setPage((current) => current + 1)}>
            Load more
          </Button>
        </Box>
      ) : null}
    </Box>
  );
};

export default GalleryPage;
