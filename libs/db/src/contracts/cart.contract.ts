import type { LineOptions } from './commerce.contract';

// A cart line is only a reference - name, price, and availability are always re-resolved through
// the line's PurchasableSource adapter (see @inithium/ecommerce) and never trusted from storage.
export interface CartLine {
  id: string;
  sourceType: string;
  sourceId: string;
  variantId?: string;
  options: LineOptions;
  quantity: number;
  addedAt: Date;
}

export interface CartEntity {
  id: string;
  userId: string; // FK -> UserEntity.id; exactly one cart per user
  lines: CartLine[];
  // At most one promo code per cart - codes never stack with each other.
  discountCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveCartInput {
  lines?: CartLine[];
  discountCode?: string | null;
}

export interface CartRepository {
  findByUserId: (userId: string) => Promise<CartEntity | null>;
  // Upserts - the first write for a user creates their cart.
  save: (userId: string, input: SaveCartInput) => Promise<CartEntity>;
  // Atomic $pull so lines added in another tab between checkout and finalization survive.
  removeLines: (userId: string, lineIds: string[]) => Promise<void>;
}
