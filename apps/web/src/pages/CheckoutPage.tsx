import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { alert, Box, Button, Checkbox, Divider, Loader, RadioGroup, RadioGroupItem, Text, useNavigateWithTransition } from '@inithium/ui';
import {
  describeRenewal,
  formatMoney,
  readApiError,
  useConfirmOrderPaymentMutation,
  useGetCartQuery,
  useGetStoreConfigQuery,
  useListShippingMethodsQuery,
  usePlaceOrderMutation,
  useQuoteCheckoutMutation,
} from '@inithium/api-client';
import type { CheckoutDetailsInput, CheckoutQuoteDto, PostalAddressInput, ShippingMethodDto } from '@inithium/api-client';
import { useCurrentUser } from '../app/useCurrentUser';
import { AddressFields, emptyAddress, isAddressComplete, toAddressPayload, validateAddress } from './ecommerce/AddressFields';
import type { AddressErrors } from './ecommerce/AddressFields';
import { PaymentFields } from './ecommerce/payment/PaymentFields';
import type { PaymentFieldsHandle } from './ecommerce/payment/payment-fields.contract';
import { PriceSummary } from './ecommerce/PriceSummary';
import { SignInPrompt } from './ecommerce/SignInPrompt';

const ALERT_POSITION = 'bottom-right' as const;
const QUOTE_DEBOUNCE_MS = 500;

const Section = ({ title, children }: { readonly title: string; readonly children: ReactNode }) => (
  <Box flex={{ direction: 'col', gap: 16 }}>
    <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-semibold">
      {title}
    </Text>
    {children}
  </Box>
);

const describeShippingMethod = (method: ShippingMethodDto, currency: string): string => {
  const price = method.amountCents === 0 ? 'Free' : formatMoney(method.amountCents, currency);
  const freeOver = method.freeOverCents !== undefined ? ` · free over ${formatMoney(method.freeOverCents, currency)}` : '';
  return `${method.name} — ${price}${freeOver}`;
};

// The compact, read-only order summary beside the form - editing happens on the cart page.
const CheckoutSummary = ({
  quote,
  fallbackSubtotalCents,
  currency,
  lines,
}: {
  readonly quote: CheckoutQuoteDto | null;
  readonly fallbackSubtotalCents: number;
  readonly currency: string;
  readonly lines: { id: string; name: string; quantity: number; totalCents: number }[];
}) => {
  const navigate = useNavigateWithTransition();
  const pending = { amountCents: null, pendingLabel: 'Enter your address' };
  return (
    <Box
      bgColor={{ color: 'surface', intensity: 200 }}
      padding={{ base: 24 }}
      flex={{ direction: 'col', gap: 16 }}
      className="h-fit rounded-lg lg:sticky lg:top-6"
    >
      <Box flex={{ direction: 'row', justify: 'between', align: 'center' }}>
        <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-semibold">
          Order summary
        </Text>
        <Button variant={{ kind: 'link', color: 'accent' }} textColor={{ color: 'surface', intensity: 800 }} onClick={() => navigate('/cart')}>
          Edit cart
        </Button>
      </Box>
      <Box flex={{ direction: 'col', gap: 8 }}>
        {lines.map((line) => (
          <Box key={line.id} flex={{ direction: 'row', justify: 'between', gap: 12 }}>
            <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="min-w-0 truncate text-sm">
              {`${line.name} × ${line.quantity}`}
            </Text>
            <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm tabular-nums">
              {formatMoney(line.totalCents, currency)}
            </Text>
          </Box>
        ))}
      </Box>
      <Divider color={{ color: 'surface', intensity: 300 }} />
      <PriceSummary
        currency={currency}
        rows={[
          { label: 'Subtotal', amountCents: quote?.subtotalCents ?? fallbackSubtotalCents },
          ...(quote && quote.discountCents > 0 ? [{ label: `Discount${quote.discount ? ` (${quote.discount.code})` : ''}`, amountCents: quote.discountCents, isDeduction: true }] : []),
          ...(quote?.requiresShipping ? [{ label: 'Shipping', amountCents: quote.shippingCents }] : []),
          quote ? { label: 'Tax', amountCents: quote.taxCents } : { label: 'Tax', ...pending },
        ]}
        totalLabel="Due today"
        totalCents={quote?.totalCents ?? fallbackSubtotalCents}
      />
      {quote && quote.recurring.length > 0 ? (
        <Box flex={{ direction: 'col', gap: 4 }}>
          {quote.lines
            .filter((line) => line.billing.type === 'recurring')
            .map((line) => (
              <Text key={line.id} as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
                {`${line.name}: ${describeRenewal(line.billing, line.quantity, currency)}, plus tax`}
              </Text>
            ))}
        </Box>
      ) : null}
    </Box>
  );
};

export const CheckoutPage = () => {
  const navigate = useNavigateWithTransition();
  const { currentUser, isResolving } = useCurrentUser();
  const { data: cart, isLoading: isCartLoading } = useGetCartQuery(currentUser?.id ?? '', { skip: !currentUser });
  const { data: storeConfig } = useGetStoreConfigQuery();
  const { data: shippingMethods = [] } = useListShippingMethodsQuery(undefined, { skip: !cart?.requiresShipping });
  const [quoteCheckout] = useQuoteCheckoutMutation();
  const [placeOrder] = usePlaceOrderMutation();
  const [confirmOrderPayment] = useConfirmOrderPaymentMutation();
  const paymentRef = useRef<PaymentFieldsHandle>(null);

  const [shippingMethodId, setShippingMethodId] = useState<string | undefined>(undefined);
  const [shippingAddress, setShippingAddress] = useState<PostalAddressInput>(emptyAddress);
  const [billingAddress, setBillingAddress] = useState<PostalAddressInput>(emptyAddress);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [shippingErrors, setShippingErrors] = useState<AddressErrors>({});
  const [billingErrors, setBillingErrors] = useState<AddressErrors>({});
  const [quote, setQuote] = useState<CheckoutQuoteDto | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);

  useEffect(() => {
    if (!shippingMethodId && shippingMethods.length > 0) setShippingMethodId(shippingMethods[0]!.id);
  }, [shippingMethods, shippingMethodId]);

  const selectedMethod = shippingMethods.find((method) => method.id === shippingMethodId);
  const needsShippingAddress = Boolean(cart?.requiresShipping && selectedMethod?.requiresAddress);
  const effectiveBilling = needsShippingAddress && billingSameAsShipping ? shippingAddress : billingAddress;

  // The details the API prices against, or null while the form can't be quoted yet.
  const details = useMemo((): CheckoutDetailsInput | null => {
    if (!cart) return null;
    if (cart.requiresShipping && !selectedMethod) return null;
    if (needsShippingAddress && !isAddressComplete(shippingAddress)) return null;
    if (!isAddressComplete(effectiveBilling)) return null;
    return {
      billingAddress: toAddressPayload(effectiveBilling),
      ...(cart.requiresShipping && selectedMethod ? { shippingMethodId: selectedMethod.id } : {}),
      ...(needsShippingAddress ? { shippingAddress: toAddressPayload(shippingAddress) } : {}),
    };
  }, [cart, selectedMethod, needsShippingAddress, shippingAddress, effectiveBilling]);

  // Re-quotes (tax depends on the address, shipping on the method) whenever the priced inputs
  // settle - also when the cart itself changes, e.g. in another tab.
  const detailsKey = details ? JSON.stringify(details) : null;
  const cartKey = cart ? `${cart.totalCents}|${cart.lines.map((line) => `${line.id}:${line.quantity}`).join(',')}` : '';
  useEffect(() => {
    if (!details) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const next = await quoteCheckout(details).unwrap();
        if (!cancelled) {
          setQuote(next);
          setQuoteError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(readApiError(error, 'We couldn’t calculate your total.').message);
        }
      }
    }, QUOTE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // detailsKey/cartKey stand in for the objects they serialize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsKey, cartKey, quoteCheckout]);

  if (isResolving || (currentUser && isCartLoading)) {
    return (
      <Box flex={{ justify: 'center' }} padding={{ base: 48 }}>
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      </Box>
    );
  }
  if (!currentUser) return <SignInPrompt message="Log in to check out." redirectTo="/checkout" />;

  if (!cart || cart.lines.length === 0) {
    return (
      <Box flex={{ direction: 'col', align: 'center', gap: 16 }} padding={{ top: 48, bottom: 48 }}>
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
          Your cart is empty.
        </Text>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => navigate('/merch')}>
          Continue shopping
        </Button>
      </Box>
    );
  }
  if (cart.hasUnavailableLines) {
    return (
      <Box flex={{ direction: 'col', align: 'center', gap: 16 }} padding={{ top: 48, bottom: 48 }}>
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }}>
          Some items in your cart are no longer available.
        </Text>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => navigate('/cart')}>
          Review cart
        </Button>
      </Box>
    );
  }

  const currency = cart.currency;
  const payment = storeConfig?.payment ?? null;
  const amountDueCents = quote?.totalCents ?? cart.totalCents;
  const hasRecurring = cart.lines.some((line) => line.billing?.type === 'recurring');
  const needsPayment = amountDueCents > 0;

  const validateForm = (): boolean => {
    const nextShippingErrors = needsShippingAddress ? validateAddress(shippingAddress) : {};
    const nextBillingErrors = needsShippingAddress && billingSameAsShipping ? {} : validateAddress(billingAddress);
    setShippingErrors(nextShippingErrors);
    setBillingErrors(nextBillingErrors);
    return Object.keys(nextShippingErrors).length === 0 && Object.keys(nextBillingErrors).length === 0;
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) {
      alert.danger('Please complete the highlighted fields.', { position: ALERT_POSITION });
      return;
    }
    if (!details || !quote) return;

    setIsPlacing(true);
    let pendingOrderId: string | null = null;
    try {
      const paymentToken =
        quote.totalCents > 0
          ? await paymentRef.current!.createPaymentToken({
              ...(effectiveBilling.name ? { name: effectiveBilling.name } : {}),
              email: currentUser.email,
              address: toAddressPayload(effectiveBilling),
            })
          : undefined;

      let result = await placeOrder({
        ...details,
        ...(paymentToken ? { paymentToken } : {}),
        expectedTotalCents: quote.totalCents,
      }).unwrap();

      if (result.status === 'requires_action') {
        pendingOrderId = result.order.id;
        await paymentRef.current!.handleNextAction(result.clientSecret);
        result = await confirmOrderPayment(result.order.id).unwrap();
      }
      navigate(`/orders/${result.order.id}`);
    } catch (error) {
      // A verification step the shopper abandoned: let the API settle that order (it releases the
      // held stock) so retrying starts clean.
      if (pendingOrderId) await confirmOrderPayment(pendingOrderId).unwrap().catch(() => undefined);

      if (error instanceof Error) {
        alert.danger(error.message, { position: ALERT_POSITION });
        return;
      }
      const info = readApiError(error, 'Your order could not be placed.');
      const changedQuote = info.details?.['quote'] as CheckoutQuoteDto | undefined;
      if (info.status === 409 && changedQuote) {
        setQuote(changedQuote);
        alert.info('Your order total changed. Please review it before paying.', { position: ALERT_POSITION });
        return;
      }
      alert.danger(info.message, { position: ALERT_POSITION });
    } finally {
      setIsPlacing(false);
    }
  };

  const summaryLines = quote
    ? quote.lines.map((line) => ({ id: line.id, name: line.name, quantity: line.quantity, totalCents: line.subtotalCents - line.discountCents }))
    : cart.lines.map((line) => ({
        id: line.id,
        name: line.name ?? 'Item',
        quantity: line.quantity,
        totalCents: (line.subtotalCents ?? 0) - (line.discountCents ?? 0),
      }));

  const canPlaceOrder = Boolean(quote) && !isPlacing && (!needsPayment || Boolean(payment));

  return (
    <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }}>
      <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-3xl font-bold">
        Checkout
      </Text>

      <Box className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Box flex={{ direction: 'col', gap: 32 }} className="lg:col-span-2">
          {cart.requiresShipping ? (
            <Section title="Shipping">
              {shippingMethods.length === 0 ? (
                <Text as="p" textColor={{ color: 'surface', intensity: 700 }}>
                  No shipping options are available right now.
                </Text>
              ) : (
                <RadioGroup value={shippingMethodId ?? ''} onValueChange={setShippingMethodId} disabled={isPlacing}>
                  {shippingMethods.map((method) => (
                    <RadioGroupItem key={method.id} value={method.id} label={describeShippingMethod(method, currency)} />
                  ))}
                </RadioGroup>
              )}
              {needsShippingAddress ? (
                <AddressFields idPrefix="shipping" value={shippingAddress} onChange={setShippingAddress} errors={shippingErrors} disabled={isPlacing} />
              ) : null}
            </Section>
          ) : null}

          <Section title="Billing address">
            {needsShippingAddress ? (
              <Checkbox
                label="Same as shipping address"
                checked={billingSameAsShipping}
                onCheckedChange={(checked) => setBillingSameAsShipping(checked === true)}
                disabled={isPlacing}
              />
            ) : null}
            {!needsShippingAddress || !billingSameAsShipping ? (
              <AddressFields idPrefix="billing" value={billingAddress} onChange={setBillingAddress} errors={billingErrors} disabled={isPlacing} />
            ) : null}
          </Section>

          {needsPayment ? (
            <Section title="Payment">
              {payment ? (
                <PaymentFields
                  ref={paymentRef}
                  provider={payment.provider}
                  publishableKey={payment.publishableKey}
                  amountCents={amountDueCents}
                  currency={currency}
                  saveForFutureUse={hasRecurring}
                />
              ) : (
                <Text as="p" textColor={{ color: 'surface', intensity: 700 }}>
                  Online payments aren’t set up yet. Please check back soon.
                </Text>
              )}
              {hasRecurring ? (
                <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
                  Your payment method will be saved and charged automatically for the recurring items in this order.
                </Text>
              ) : null}
            </Section>
          ) : null}

          {quoteError ? (
            <Text as="p" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
              {quoteError}
            </Text>
          ) : null}

          <Button variant={{ kind: 'filled', color: 'primary' }} disabled={!canPlaceOrder} onClick={handlePlaceOrder} className="w-full sm:w-auto sm:self-end">
            {isPlacing ? 'Placing order…' : quote && quote.totalCents > 0 ? `Pay ${formatMoney(quote.totalCents, currency)}` : 'Place order'}
          </Button>
        </Box>

        <CheckoutSummary quote={quote} fallbackSubtotalCents={cart.totalCents} currency={currency} lines={summaryLines} />
      </Box>
    </Box>
  );
};

export default CheckoutPage;
