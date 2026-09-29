import type { CalculateTaxInput, TaxCalculation, TaxProvider } from '../../contracts/tax-provider.contract';
import { getStripe, isStripeTaxEnabled, STRIPE_SHIPPING_TAX_CODE } from './stripe.client';

const zeroTax = (input: CalculateTaxInput): TaxCalculation => ({
  calculationId: null,
  lines: input.lines.map((line) => ({ reference: line.reference, taxCents: 0 })),
  shippingTaxCents: 0,
  totalTaxCents: 0,
});

// Stripe Tax: the origin (head office) address and tax registrations are configured in the Stripe
// dashboard, not here - an account without Stripe Tax activated rejects every calculation.
export const stripeTaxProvider: TaxProvider = {
  name: 'stripe-tax',

  calculate: async (input: CalculateTaxInput): Promise<TaxCalculation> => {
    if (!isStripeTaxEnabled()) return zeroTax(input);

    // Stripe requires positive line amounts; a fully-discounted line carries no tax anyway. With no
    // chargeable line left there's nothing Stripe will calculate against, so the (rare)
    // shipping-only remainder goes untaxed rather than failing the checkout.
    const chargeable = input.lines.filter((line) => line.amountCents > 0);
    if (chargeable.length === 0) return zeroTax(input);

    const calculation = await getStripe().tax.calculations.create({
      currency: input.currency,
      customer_details: {
        address: {
          line1: input.address.line1,
          line2: input.address.line2 ?? '',
          city: input.address.city,
          state: input.address.state ?? '',
          postal_code: input.address.postalCode,
          country: input.address.country,
        },
        address_source: input.addressSource,
      },
      line_items: chargeable.map((line) => ({
        amount: line.amountCents,
        quantity: line.quantity,
        reference: line.reference,
        tax_behavior: 'exclusive',
        ...(line.taxCode ? { tax_code: line.taxCode } : {}),
      })),
      ...(input.shippingCents > 0
        ? { shipping_cost: { amount: input.shippingCents, tax_behavior: 'exclusive', tax_code: STRIPE_SHIPPING_TAX_CODE } }
        : {}),
      expand: ['line_items'],
    });

    const taxByReference = new Map((calculation.line_items?.data ?? []).map((item) => [item.reference, item.amount_tax]));

    return {
      calculationId: calculation.id,
      lines: input.lines.map((line) => ({ reference: line.reference, taxCents: taxByReference.get(line.reference) ?? 0 })),
      shippingTaxCents: calculation.shipping_cost?.amount_tax ?? 0,
      totalTaxCents: calculation.tax_amount_exclusive,
    };
  },

  commit: async (calculationId: string, reference: string): Promise<void> => {
    await getStripe().tax.transactions.createFromCalculation({ calculation: calculationId, reference });
  },
};
