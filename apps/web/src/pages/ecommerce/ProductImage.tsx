import { Box, Icon } from '@inithium/ui';

interface ProductImageProps {
  readonly src?: string;
  readonly alt: string;
  readonly className?: string;
}

// A product (or any cart line) with no image gets a neutral themed placeholder rather than a
// broken <img>, so grids and line lists keep their shape.
export const ProductImage = ({ src, alt, className }: ProductImageProps) =>
  src ? (
    <img src={src} alt={alt} className={`h-full w-full object-cover ${className ?? ''}`} />
  ) : (
    <Box bgColor={{ color: 'surface', intensity: 200 }} flex={{ align: 'center', justify: 'center' }} className={`h-full w-full ${className ?? ''}`}>
      <Icon name="Package" size={40} textColor={{ color: 'surface', intensity: 500 }} />
    </Box>
  );
