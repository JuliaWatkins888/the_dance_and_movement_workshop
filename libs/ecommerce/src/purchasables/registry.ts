import type { PurchasableSource } from './purchasable.contract';
import productPurchasable from './product.purchasable';
// inithium:anchor:imports

// Every source a cart line may point at. A workspace makes another collection purchasable by
// writing a PurchasableSource (e.g. libs/ecommerce/src/purchasables/class.purchasable.ts) and
// listing it here; a plugin does the same through a merge injection at these anchors. The backend
// has no import.meta.glob equivalent for zero-edit discovery, so this stays an explicit list -
// the same trade-off page-seeds/registry.ts documents.
export const purchasableSources: PurchasableSource[] = [
  productPurchasable,
  // inithium:anchor:sources
];

export const findPurchasableSource = (sourceType: string): PurchasableSource | undefined =>
  purchasableSources.find((source) => source.sourceType === sourceType);
