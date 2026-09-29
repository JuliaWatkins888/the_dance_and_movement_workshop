import type { ClearableUpdate } from './commerce.contract';

export interface ShippingMethodEntity {
  id: string;
  name: string; // e.g. "Standard", "Studio pickup"
  description?: string;
  amountCents: number;
  // Shipping becomes free once the discounted subtotal reaches this amount.
  freeOverCents?: number;
  // false for pickup-style methods - checkout then taxes against the billing address instead.
  requiresAddress: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateShippingMethodInput = Omit<ShippingMethodEntity, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateShippingMethodInput = ClearableUpdate<CreateShippingMethodInput>;

export interface ShippingMethodRepository {
  findAll: () => Promise<ShippingMethodEntity[]>;
  findActive: () => Promise<ShippingMethodEntity[]>;
  findById: (id: string) => Promise<ShippingMethodEntity | null>;
  create: (input: CreateShippingMethodInput) => Promise<ShippingMethodEntity>;
  update: (id: string, input: UpdateShippingMethodInput) => Promise<ShippingMethodEntity | null>;
  delete: (id: string) => Promise<boolean>;
}
