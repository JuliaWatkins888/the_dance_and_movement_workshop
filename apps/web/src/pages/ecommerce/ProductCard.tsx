import { Box, Card, Pill, Text } from '@inithium/ui';
import { formatBillingInterval, formatMoney, isProductSoldOut, productPriceRange } from '@inithium/api-client';
import type { ProductDto } from '@inithium/api-client';
import { ProductImage } from './ProductImage';

interface ProductCardProps {
  readonly product: ProductDto;
  readonly currency: string;
  readonly onOpen: (product: ProductDto) => void;
}

export const formatProductPrice = (product: ProductDto, currency: string): string => {
  const { minCents, varies } = productPriceRange(product);
  const amount = `${varies ? 'From ' : ''}${formatMoney(minCents, currency)}`;
  return product.billing.type === 'recurring'
    ? `${amount} / ${formatBillingInterval(product.billing.interval, product.billing.intervalCount)}`
    : amount;
};

// Only what a shopper scans a grid for - image, name, price, availability. Description, options,
// and stock detail live in the product dialog.
export const ProductCard = ({ product, currency, onOpen }: ProductCardProps) => {
  const soldOut = isProductSoldOut(product);
  return (
    <Card
      onClick={() => onOpen(product)}
      padding={{ base: 16 }}
      className="group h-full transition-shadow hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
      media={
        <Box className="relative aspect-square w-full overflow-hidden">
          <ProductImage src={product.imageUrl} alt={product.name} className="transition-transform duration-300 group-hover:scale-105" />
          {soldOut ? (
            <Pill color={{ color: 'surface', intensity: 900 }} className="absolute left-3 top-3 text-surface-100">
              Sold out
            </Pill>
          ) : null}
        </Box>
      }
    >
      <Box flex={{ direction: 'col', gap: 4 }}>
        <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="truncate font-semibold">
          {product.name}
        </Text>
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm tabular-nums">
          {formatProductPrice(product, currency)}
        </Text>
      </Box>
    </Card>
  );
};
