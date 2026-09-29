import { IconButton, useNavigateWithTransition } from '@inithium/ui';
import { useGetCartQuery } from '@inithium/api-client';
import { useCurrentUser } from '../useCurrentUser';
import type { NavbarActionDescriptor } from './registry';

const MAX_BADGE_COUNT = 99;

// Always visible so the store is discoverable; a signed-out visitor lands on the cart page's
// sign-in prompt.
const CartNavbarButton = () => {
  const navigate = useNavigateWithTransition();
  const { currentUser } = useCurrentUser();
  const { data: cart } = useGetCartQuery(currentUser?.id ?? '', { skip: !currentUser });
  const itemCount = cart?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
  const label = itemCount > 0 ? `Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}` : 'Cart';

  return (
    <span className="relative inline-flex">
      <IconButton
        icon="ShoppingCart"
        label={label}
        variant={{ kind: 'ghost', color: 'surface' }}
        textColor={{ color: 'surface', intensity: 900 }}
        iconSize={22}
        onClick={() => navigate('/cart')}
      />
      {itemCount > 0 ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-500 px-1 text-[10px] font-bold text-primary-foreground-500"
        >
          {itemCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : itemCount}
        </span>
      ) : null}
    </span>
  );
};

const cartNavbarAction: NavbarActionDescriptor = {
  id: 'cart',
  order: 10,
  Component: CartNavbarButton,
};

export default cartNavbarAction;
