import { useState } from 'react';
import { alert, Box, Button, dialog, Divider, IconButton, Input, Loader, Text, useNavigateWithTransition } from '@inithium/ui';
import {
  CLASS_SOURCE_TYPE,
  WORKSHOP_SOURCE_TYPE,
  describeRenewal,
  formatMoney,
  readApiError,
  useApplyCartDiscountCodeMutation,
  useClearCartMutation,
  useGetCartQuery,
  useRemoveCartDiscountCodeMutation,
  useRemoveCartLineMutation,
  useUpdateCartLineQuantityMutation,
} from '@inithium/api-client';
import type { CartDto, CartLineDto } from '@inithium/api-client';
import { useCurrentUser } from '../app/useCurrentUser';
import { PriceSummary } from './ecommerce/PriceSummary';
import { ProductImage } from './ecommerce/ProductImage';
import { QuantityStepper } from './ecommerce/QuantityStepper';
import { SignInPrompt } from './ecommerce/SignInPrompt';

const ALERT_POSITION = 'bottom-right' as const;
const MAX_QUANTITY = 99;

interface CartLineRowProps {
  readonly line: CartLineDto;
  readonly currency: string;
}

const CartLineRow = ({ line, currency }: CartLineRowProps) => {
  const navigate = useNavigateWithTransition();
  const [updateQuantity, { isLoading: isUpdating }] = useUpdateCartLineQuantityMutation();
  const [removeLine, { isLoading: isRemoving }] = useRemoveCartLineMutation();
  const isBusy = isUpdating || isRemoving;

  const changeQuantity = async (quantity: number) => {
    try {
      await updateQuantity({ lineId: line.id, quantity }).unwrap();
    } catch (error) {
      alert.danger(readApiError(error, 'Could not update the quantity.').message, { position: ALERT_POSITION });
    }
  };

  const remove = async () => {
    try {
      await removeLine(line.id).unwrap();
    } catch (error) {
      alert.danger(readApiError(error, 'Could not remove this item.').message, { position: ALERT_POSITION });
    }
  };

  const renewal = line.billing ? describeRenewal(line.billing, line.quantity, currency) : null;
  const name = line.name ?? 'Unavailable item';
  // A single-unit item (e.g. one dancer's class registration) has no quantity to choose.
  const isSingleUnit = line.maxQuantity === 1;

  return (
    <Box flex={{ direction: 'row', gap: 16 }} padding={{ top: 16, bottom: 16 }} className={isBusy ? 'opacity-60' : undefined}>
      <Box className="h-24 w-24 shrink-0 overflow-hidden rounded-md">
        <ProductImage src={line.imageUrl} alt={name} />
      </Box>

      <Box flex={{ direction: 'col', gap: 8 }} className="min-w-0 flex-1">
        <Box flex={{ direction: 'row', justify: 'between', align: 'start', gap: 12 }}>
          <Box flex={{ direction: 'col', gap: 4 }} className="min-w-0">
            {line.href ? (
              <Button
                variant={{ kind: 'link', color: 'accent' }}
                textColor={{ color: 'surface', intensity: 950 }}
                className="justify-start p-0 text-left font-semibold"
                onClick={() => navigate(line.href!)}
              >
                {name}
              </Button>
            ) : (
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
                {name}
              </Text>
            )}
            {(line.sourceType === CLASS_SOURCE_TYPE || line.sourceType === WORKSHOP_SOURCE_TYPE) && line.description ? (
              <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
                {line.description}
              </Text>
            ) : null}
            {line.available && line.unitAmountCents !== undefined && !isSingleUnit ? (
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm tabular-nums">
                {`${formatMoney(line.unitAmountCents, currency)} each`}
              </Text>
            ) : null}
            {renewal ? (
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
                {renewal}
              </Text>
            ) : null}
            {!line.available ? (
              <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm font-medium">
                {line.unavailableReason ?? 'This item is no longer available.'}
              </Text>
            ) : null}
          </Box>
          <IconButton
            icon="Trash"
            label={`Remove ${name}`}
            variant={{ kind: 'ghost', color: 'surface' }}
            textColor={{ color: 'surface', intensity: 700 }}
            disabled={isBusy}
            onClick={remove}
          />
        </Box>

        <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }}>
          {line.available && !isSingleUnit ? (
            <QuantityStepper
              value={line.quantity}
              max={Math.min(MAX_QUANTITY, line.maxQuantity ?? MAX_QUANTITY)}
              onChange={changeQuantity}
              disabled={isBusy}
            />
          ) : (
            <span />
          )}
          {line.available && line.subtotalCents !== undefined ? (
            <Box flex={{ direction: 'col', align: 'end' }}>
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold tabular-nums">
                {formatMoney(line.subtotalCents - (line.discountCents ?? 0), currency)}
              </Text>
              {line.discountCents ? (
                <Text as="span" textColor={{ color: 'surface', intensity: 500 }} className="text-xs tabular-nums line-through">
                  {formatMoney(line.subtotalCents, currency)}
                </Text>
              ) : null}
            </Box>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
};

const PromoCodeForm = ({ cart }: { readonly cart: CartDto }) => {
  const [code, setCode] = useState('');
  const [applyCode, { isLoading: isApplying }] = useApplyCartDiscountCodeMutation();
  const [removeCode, { isLoading: isRemoving }] = useRemoveCartDiscountCodeMutation();
  const [error, setError] = useState<string | undefined>(undefined);

  const apply = async () => {
    if (!code.trim()) return;
    setError(undefined);
    try {
      await applyCode(code.trim()).unwrap();
      setCode('');
    } catch (applyError) {
      setError(readApiError(applyError, 'That code could not be applied.').message);
    }
  };

  if (cart.discount) {
    return (
      <Box flex={{ direction: 'col', gap: 4 }}>
        <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 8 }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm">
            {`Promo code `}
            <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
              {cart.discount.code}
            </Text>
          </Text>
          <Button variant={{ kind: 'link', color: 'accent' }} textColor={{ color: 'surface', intensity: 800 }} disabled={isRemoving} onClick={() => removeCode()}>
            Remove
          </Button>
        </Box>
        {!cart.discount.applied && cart.discount.message ? (
          <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-xs">
            {cart.discount.message}
          </Text>
        ) : null}
      </Box>
    );
  }

  return (
    <Box flex={{ direction: 'row', align: 'start', gap: 8 }}>
      <Input
        aria-label="Promo code"
        placeholder="Promo code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') apply();
        }}
        error={Boolean(error)}
        {...(error ? { helperText: error } : {})}
        className="flex-1"
      />
      <Button variant={{ kind: 'outlined', color: 'primary' }} disabled={isApplying || !code.trim()} onClick={apply}>
        Apply
      </Button>
    </Box>
  );
};

// Recurring lines are charged their first period today; the summary spells out what renews after.
const renewalNotes = (cart: CartDto): string[] =>
  cart.lines
    .filter((line) => line.available && line.billing?.type === 'recurring')
    .map((line) => `${line.name}: ${describeRenewal(line.billing!, line.quantity, cart.currency)}`);

export const CartPage = () => {
  const navigate = useNavigateWithTransition();
  const { currentUser, isResolving } = useCurrentUser();
  const { data: cart, isLoading } = useGetCartQuery(currentUser?.id ?? '', { skip: !currentUser });
  const [clearCart, { isLoading: isClearing }] = useClearCartMutation();

  if (isResolving || (currentUser && isLoading)) {
    return (
      <Box flex={{ justify: 'center' }} padding={{ base: 48 }}>
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      </Box>
    );
  }

  if (!currentUser) {
    return <SignInPrompt message="Log in to see your cart." redirectTo="/cart" />;
  }

  const confirmClear = async () => {
    const confirmed = await dialog.confirm({
      title: 'Empty your cart?',
      description: 'Every item will be removed from your cart.',
      confirmLabel: 'Empty cart',
    });
    if (confirmed) await clearCart();
  };

  const header = (
    <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-3xl font-bold">
      Your cart
    </Text>
  );

  if (!cart || cart.lines.length === 0) {
    return (
      <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }}>
        {header}
        <Box flex={{ direction: 'col', align: 'center', gap: 16 }} padding={{ top: 48, bottom: 48 }}>
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
            Your cart is empty.
          </Text>
          <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => navigate('/merch')}>
            Continue shopping
          </Button>
        </Box>
      </Box>
    );
  }

  const notes = renewalNotes(cart);

  return (
    <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
        {header}
        <Button variant={{ kind: 'ghost', color: 'surface' }} textColor={{ color: 'surface', intensity: 800 }} disabled={isClearing} onClick={confirmClear}>
          Empty cart
        </Button>
      </Box>

      <Box className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Box className="lg:col-span-2">
          {cart.lines.map((line, index) => (
            <Box key={line.id}>
              {index > 0 ? <Divider color={{ color: 'surface', intensity: 300 }} /> : null}
              <CartLineRow line={line} currency={cart.currency} />
            </Box>
          ))}
        </Box>

        <Box
          bgColor={{ color: 'surface', intensity: 200 }}
          padding={{ base: 24 }}
          flex={{ direction: 'col', gap: 20 }}
          className="h-fit rounded-lg lg:sticky lg:top-6"
        >
          <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-semibold">
            Order summary
          </Text>
          <PromoCodeForm cart={cart} />
          <PriceSummary
            currency={cart.currency}
            rows={[
              { label: 'Subtotal', amountCents: cart.subtotalCents },
              ...(cart.discountCents > 0 ? [{ label: 'Discount', amountCents: cart.discountCents, isDeduction: true }] : []),
              ...(cart.requiresShipping ? [{ label: 'Shipping', amountCents: null, pendingLabel: 'Calculated at checkout' }] : []),
              { label: 'Tax', amountCents: null, pendingLabel: 'Calculated at checkout' },
            ]}
            totalLabel="Estimated total"
            totalCents={cart.totalCents}
          />
          {notes.length > 0 ? (
            <Box flex={{ direction: 'col', gap: 4 }}>
              {notes.map((note) => (
                <Text key={note} as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
                  {note}
                </Text>
              ))}
            </Box>
          ) : null}
          {cart.hasUnavailableLines ? (
            <Text as="p" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
              Remove the unavailable items above to continue.
            </Text>
          ) : null}
          <Button variant={{ kind: 'filled', color: 'primary' }} disabled={cart.hasUnavailableLines} onClick={() => navigate('/checkout')}>
            Checkout
          </Button>
          <Button variant={{ kind: 'link', color: 'accent' }} textColor={{ color: 'surface', intensity: 800 }} onClick={() => navigate('/merch')}>
            Continue shopping
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default CartPage;
