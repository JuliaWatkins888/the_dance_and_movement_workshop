import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { alert, Box, Button, Checkbox, Divider, Loader, RadioGroup, RadioGroupItem, Text, useNavigateWithTransition } from '@inithium/ui';
import {
  describeRenewal,
  formatMoney,
  POLICY_CONSENT_REQUIRED,
  POLICY_VERSION_CHANGED,
  readApiError,
  useConfirmOrderPaymentMutation,
  useGetCartQuery,
  useGetPolicyConsentStatusQuery,
  useGetStoreConfigQuery,
  useListShippingMethodsQuery,
  usePlaceOrderMutation,
  useQuoteCheckoutMutation,
  useSignPolicyConsentMutation,
} from '@inithium/api-client';
import type { CheckoutDetailsInput, CheckoutQuoteDto, PostalAddressInput, ShippingMethodDto } from '@inithium/api-client';
import { useCurrentUser } from '../app/useCurrentUser';
import { AddressFields, emptyAddress, isAddressComplete, toAddressPayload, validateAddress } from './ecommerce/AddressFields';
import type { AddressErrors } from './ecommerce/AddressFields';
import { PaymentFields } from './ecommerce/payment/PaymentFields';
import type { PaymentFieldsHandle } from './ecommerce/payment/payment-fields.contract';
import { PolicyConsentStep, validatePolicyConsent } from './ecommerce/PolicyConsentStep';
import { PriceSummary } from './ecommerce/PriceSummary';
import { SignInPrompt } from './ecommerce/SignInPrompt';
import { useContinueShoppingPath } from './ecommerce/continueShopping';

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
      // order-first: stacked on mobile, the totals lead and the form follows.
      className="order-first h-fit rounded-lg lg:order-none lg:sticky lg:top-6"
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
  const {
    data: consentStatus,
    isError: isConsentStatusError,
    refetch: refetchConsentStatus,
  } = useGetPolicyConsentStatusQuery(undefined, { skip: !currentUser, refetchOnMountOrArgChange: true });
  const [signPolicyConsent] = useSignPolicyConsentMutation();
  const paymentRef = useRef<PaymentFieldsHandle>(null);

  const [shippingMethodId, setShippingMethodId] = useState<string | undefined>(undefined);
  const [shippingAddress, setShippingAddress] = useState<PostalAddressInput>(emptyAddress);
  const [billingAddress, setBillingAddress] = useState<PostalAddressInput>(emptyAddress);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  // Off until the first attempt to place the order; then errors follow what's typed, so each one
  // clears as soon as its field is fixed.
  const [showErrors, setShowErrors] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [quote, setQuote] = useState<CheckoutQuoteDto | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [policiesAgreed, setPoliciesAgreed] = useState(false);
  const [signedName, setSignedName] = useState('');
  const continueShoppingPath = useContinueShoppingPath(cart?.lines ?? []);

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
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => navigate(continueShoppingPath)}>
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

  const currentShippingErrors: AddressErrors = needsShippingAddress ? validateAddress(shippingAddress) : {};
  const currentBillingErrors: AddressErrors = needsShippingAddress && billingSameAsShipping ? {} : validateAddress(billingAddress);
  const currentConsentErrors = consentStatus?.required ? validatePolicyConsent(policiesAgreed, signedName) : {};

  const handlePlaceOrder = async () => {
    setShowErrors(true);
    // Disables the button right away, so a double click can't get past the await and place two orders.
    setIsValidating(true);
    // Always runs, even when the fields below have errors, so every problem shows at once.
    const paymentError = needsPayment ? ((await paymentRef.current?.validate()) ?? null) : null;
    setIsValidating(false);

    const hasFieldErrors = [currentShippingErrors, currentBillingErrors, currentConsentErrors].some((errors) => Object.keys(errors).length > 0);
    if (hasFieldErrors) {
      alert.danger('Please complete the highlighted fields.', { position: ALERT_POSITION });
      // The button sits below the form, so the first problem may be off screen. Waits a frame for
      // the error states above to render.
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (paymentError) {
      alert.danger(paymentError, { position: ALERT_POSITION });
      return;
    }
    if (!consentStatus) {
      alert.danger(
        isConsentStatusError ? 'We couldn’t load the studio policies. Please refresh the page.' : 'The studio policies are still loading. Please try again in a moment.',
        { position: ALERT_POSITION },
      );
      return;
    }
    if (!details || !quote) {
      const reason = cart.requiresShipping && !selectedMethod ? 'Please choose a shipping method.' : quoteError;
      alert.danger(reason ?? 'We’re still calculating your total. Please try again in a moment.', { position: ALERT_POSITION });
      return;
    }

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

      // After the card is validated, so an incomplete card never leaves a signature on record, and
      // before the charge, so a policy change mid-checkout can't cost anyone money.
      if (consentStatus.required) {
        await signPolicyConsent({ versionHash: consentStatus.versionHash, signedName: signedName.trim(), agreed: true }).unwrap();
      }

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
      if (info.code === POLICY_VERSION_CHANGED || info.code === POLICY_CONSENT_REQUIRED) {
        setPoliciesAgreed(false);
        refetchConsentStatus();
        alert.info(info.message, { position: ALERT_POSITION });
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

  // Only disabled when clicking couldn't help. Anything the shopper can fix is reported on click.
  const canPlaceOrder = !isPlacing && !isValidating && (!needsPayment || Boolean(payment));

  return (
    <Box flex={{ direction: 'col', gap: 24 }} className="p-4 md:p-8">
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
                <AddressFields idPrefix="shipping" value={shippingAddress} onChange={setShippingAddress} errors={showErrors ? currentShippingErrors : {}} disabled={isPlacing} />
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
              <AddressFields idPrefix="billing" value={billingAddress} onChange={setBillingAddress} errors={showErrors ? currentBillingErrors : {}} disabled={isPlacing} />
            ) : null}
          </Section>

          {consentStatus?.required ? (
            <Section title="Studio Policies">
              <PolicyConsentStep
                policies={consentStatus.policies}
                agreed={policiesAgreed}
                signedName={signedName}
                onAgreedChange={setPoliciesAgreed}
                onSignedNameChange={setSignedName}
                errors={showErrors ? currentConsentErrors : {}}
                disabled={isPlacing}
              />
            </Section>
          ) : null}
          {isConsentStatusError && !consentStatus ? (
            <Text as="p" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
              We couldn’t load the studio policies. Please refresh the page to continue.
            </Text>
          ) : null}

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
