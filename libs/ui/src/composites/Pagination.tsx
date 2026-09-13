import { Box, Button, IconButton } from '../components';

export interface PaginationProps {
  readonly page: number;
  readonly totalPages: number;
  readonly onPageChange: (page: number) => void;
  readonly className?: string;
}

export const Pagination = ({ page, totalPages, onPageChange, className }: PaginationProps) => {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <Box flex={{ direction: 'row', align: 'center', justify: 'center', gap: 8 }} className={className}>
      <IconButton
        icon="CaretLeft"
        label="Previous page"
        variant={{ kind: 'filled', color: 'primary' }}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      />
      {pages.map((pageNumber) => (
        <Button
          key={pageNumber}
          variant={{ kind: 'ghost', color: 'accent' }}
          onClick={() => onPageChange(pageNumber)}
          aria-current={pageNumber === page ? 'page' : undefined}
        >
          {pageNumber}
        </Button>
      ))}
      <IconButton
        icon="CaretRight"
        label="Next page"
        variant={{ kind: 'filled', color: 'primary' }}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      />
    </Box>
  );
};
