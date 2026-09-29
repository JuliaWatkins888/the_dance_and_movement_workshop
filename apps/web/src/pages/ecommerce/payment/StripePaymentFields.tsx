import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import type { Appearance, Stripe } from '@stripe/stripe-js';
import type { PaymentBillingDetails, PaymentFieldsHandle, PaymentFieldsProps } from './payment-fields.contract';

// loadStripe must run once per key, not per render.
const stripePromises = new Map<string, Promise<Stripe | null>>();
const getStripePromise = (publishableKey: string): Promise<Stripe | null> => {
  const existing = stripePromises.get(publishableKey);
  if (existing) return existing;
  const created = loadStripe(publishableKey);
  stripePromises.set(publishableKey, created);
  return created;
};

const readCssVar = (name: string, fallback: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

// Stripe renders inside its own iframe, so it can't see our Tailwind classes - its Appearance API
// is fed the live values of the same --ui-* tokens instead. Surface tokens flip for dark mode.
const buildAppearance = (): Appearance => ({
  theme: 'stripe',
  variables: {
    colorPrimary: readCssVar('--ui-primary-500', '#006a8e'),
    colorBackground: readCssVar('--ui-surface-100', '#f8fafc'),
    colorText: readCssVar('--ui-surface-950', '#0f172a'),
    colorTextSecondary: readCssVar('--ui-surface-700', '#334155'),
    borderRadius: '8px',
  },
  rules: {
    '.Input': { borderColor: readCssVar('--ui-surface-300', '#e2e8f0') },
  },
});

// Rebuilds the appearance whenever <html data-theme> changes (see RootRouter's dark-mode effect).
const useThemedAppearance = (): Appearance => {
  const [appearance, setAppearance] = useState<Appearance>(buildAppearance);
  useEffect(() => {
    const observer = new MutationObserver(() => setAppearance(buildAppearance()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
    return () => observer.disconnect();
  }, []);
  return appearance;
};

const StripeFieldsInner = forwardRef<PaymentFieldsHandle>((_props, ref) => {
  const stripe = useStripe();
  const elements = useElements();

  useImperativeHandle(
    ref,
    () => ({
      createPaymentToken: async ({ name, email, address }: PaymentBillingDetails) => {
        if (!stripe || !elements) throw new Error('The payment form is still loading. Please try again.');

        const { error: submitError } = await elements.submit();
        if (submitError) throw new Error(submitError.message ?? 'Please check your payment details.');

        const { error, confirmationToken } = await stripe.createConfirmationToken({
          elements,
          params: {
            payment_method_data: {
              billing_details: {
                ...(name ? { name } : {}),
                ...(email ? { email } : {}),
                address: {
                  line1: address.line1,
                  line2: address.line2 ?? '',
                  city: address.city,
                  state: address.state ?? '',
                  postal_code: address.postalCode,
                  country: address.country,
                },
              },
            },
          },
        });
        if (error || !confirmationToken) throw new Error(error?.message ?? 'Your payment details could not be processed.');
        return confirmationToken.id;
      },
      handleNextAction: async (clientSecret: string) => {
        if (!stripe) throw new Error('The payment form is still loading. Please try again.');
        const { error } = await stripe.handleNextAction({ clientSecret });
        if (error) throw new Error(error.message ?? 'Payment verification was not completed.');
      },
    }),
    [stripe, elements],
  );

  // The billing address comes from our own address form, so Stripe doesn't ask for it twice.
  return <PaymentElement options={{ layout: 'tabs', fields: { billingDetails: { address: 'never' } } }} />;
});
StripeFieldsInner.displayName = 'StripeFieldsInner';

// Deferred-intent Payment Element: it collects one payment method for the whole cart total, and
// the API creates and confirms the single charge from the ConfirmationToken it produces.
export const StripePaymentFields = forwardRef<PaymentFieldsHandle, PaymentFieldsProps>(
  ({ publishableKey, amountCents, currency, saveForFutureUse }, ref) => {
    const stripePromise = useMemo(() => getStripePromise(publishableKey), [publishableKey]);
    const appearance = useThemedAppearance();

    return (
      <Elements
        stripe={stripePromise}
        options={{
          mode: 'payment',
          amount: amountCents,
          currency: currency.toLowerCase(),
          // Cards (including Apple Pay / Google Pay wallets) only: the API confirms payments with
          // redirects disabled, so a redirect-based method offered here could never complete.
          paymentMethodTypes: ['card'],
          ...(saveForFutureUse ? { setupFutureUsage: 'off_session' as const } : {}),
          appearance,
        }}
      >
        <StripeFieldsInner ref={ref} />
      </Elements>
    );
  },
);
StripePaymentFields.displayName = 'StripePaymentFields';
