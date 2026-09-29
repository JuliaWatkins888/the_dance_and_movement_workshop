import { randomUUID } from 'node:crypto';
import type { DiscountEntity, OrderDiscountSnapshot, OrderLine } from '@inithium/db';
import type { PricedLine } from '../pricing/pricing';

// Freezes a priced line into an order line - the copy order history keeps no matter what later
// happens to the product, class, or promo code it came from. Shared by checkout and staff-created
// orders so both record exactly the same shape.
export const toOrderLine = (line: PricedLine, taxCents: number, cartLineId?: string): OrderLine => ({
  id: randomUUID(),
  ...(cartLineId ? { cartLineId } : {}),
  sourceType: line.ref.sourceType,
  sourceId: line.ref.sourceId,
  ...(line.ref.variantId ? { variantId: line.ref.variantId } : {}),
  options: line.ref.options,
  name: line.resolved.name,
  ...(line.resolved.description ? { description: line.resolved.description } : {}),
  ...(line.resolved.imageUrl ? { imageUrl: line.resolved.imageUrl } : {}),
  ...(line.resolved.href ? { href: line.resolved.href } : {}),
  categories: line.resolved.categories,
  ...(line.resolved.taxCode ? { taxCode: line.resolved.taxCode } : {}),
  requiresShipping: line.resolved.requiresShipping,
  unitAmountCents: line.unitAmountCents,
  quantity: line.ref.quantity,
  subtotalCents: line.subtotalCents,
  discountCents: line.discountCents,
  taxCents,
  totalCents: line.subtotalCents - line.discountCents + taxCents,
  billing:
    line.schedule && line.recurring
      ? {
          type: 'recurring',
          interval: line.schedule.interval,
          intervalCount: line.schedule.intervalCount,
          recurringUnitAmountCents: line.recurring.unitAmountCents,
          recurringDiscountCents: line.recurring.discountCents,
          firstBillingAt: line.schedule.firstBillingAt,
          ...(line.schedule.endsAt ? { endsAt: line.schedule.endsAt } : {}),
        }
      : { type: 'one_time' },
  reserved: false,
});

export const toOrderDiscountSnapshot = (discount: DiscountEntity): OrderDiscountSnapshot => ({
  discountId: discount.id,
  code: discount.code,
  kind: discount.kind,
  scope: discount.scope,
  value: discount.value,
  duration: discount.duration,
  ...(discount.durationInMonths ? { durationInMonths: discount.durationInMonths } : {}),
});
