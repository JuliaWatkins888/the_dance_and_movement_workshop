import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { alert, Box, Breadcrumbs, Button, Divider, Loader, Text, useNavigateWithTransition } from '@inithium/ui';
import { EVENT_SOURCE_TYPE, readApiError, useAddCartLineMutation, useGetCartQuery, useGetEventBySlugQuery } from '@inithium/api-client';
import { useCurrentUser } from '../app/useCurrentUser';
import { googleMapsLink } from '../app/studioLocation';
import { loginPathFor } from './ecommerce/SignInPrompt';
import { QuantityStepper } from './ecommerce/QuantityStepper';
import { formatCents, formatTime12h } from './classes/classFormat';
import { ProgramBanner } from './classes/ProgramBanner';
import { DetailBlock } from './classes/registrationChoices';
import { useRouteSlug } from './classes/useRouteSlug';
import {
  bulkDiscountSummary,
  eventLocation,
  formatEventDateLong,
  formatEventDateShort,
  formatEventTimes,
  formatTicketPrice,
  ticketUnitPrice,
} from './events/eventFormat';

const ALERT_POSITION = 'bottom-right' as const;
const MAX_TICKETS_PER_TYPE = 99;

const salesCloseFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export const EventDetailPage = () => {
  const slug = useRouteSlug('/events/');
  const { data: event, isLoading, isError } = useGetEventBySlugQuery(slug ?? '', { skip: !slug });
  const { currentUser } = useCurrentUser();
  const { data: cart } = useGetCartQuery(currentUser?.id ?? '', { skip: !currentUser });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [justAdded, setJustAdded] = useState(false);
  const navigate = useNavigateWithTransition();
  const location = useLocation();
  const [addCartLine, { isLoading: isAdding }] = useAddCartLineMutation();

  useEffect(() => {
    setQuantities({});
    setJustAdded(false);
  }, [event?.id]);

  if (isLoading) {
    return (
      <Box flex={{ justify: 'center' }} padding={{ base: 48 }}>
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      </Box>
    );
  }

  if (!event || isError) {
    return (
      <Box flex={{ direction: 'col', align: 'start', gap: 12 }} padding={{ base: 32 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Event not found
        </Text>
        <Button asChild variant={{ kind: 'outlined', color: 'primary' }}>
          <Link to="/events">Browse all events</Link>
        </Button>
      </Box>
    );
  }

  const venue = eventLocation(event);
  const selectedCount = event.ticketTypes.reduce((sum, ticketType) => sum + (quantities[ticketType.id] ?? 0), 0);
  // Tickets for this event already in the cart count toward the group discount too.
  const inCartCount = (cart?.lines ?? [])
    .filter((line) => line.sourceType === EVENT_SOURCE_TYPE && line.sourceId === event.id)
    .reduce((sum, line) => sum + line.quantity, 0);
  const totalCount = selectedCount + inCartCount;
  const fullPriceCents = event.ticketTypes.reduce((sum, ticketType) => sum + ticketType.priceCents * (quantities[ticketType.id] ?? 0), 0);
  const totalCents = event.ticketTypes.reduce(
    (sum, ticketType) => sum + ticketUnitPrice(ticketType.priceCents, event.bulkDiscount, totalCount) * (quantities[ticketType.id] ?? 0),
    0,
  );

  const setQuantity = (ticketTypeId: string, quantity: number) => {
    setJustAdded(false);
    setQuantities((current) => ({ ...current, [ticketTypeId]: quantity }));
  };

  const handleAddToCart = async () => {
    if (!currentUser) {
      navigate(loginPathFor(`${location.pathname}${location.search}`));
      return;
    }
    const selected = event.ticketTypes.filter((ticketType) => (quantities[ticketType.id] ?? 0) > 0);
    try {
      for (const ticketType of selected) {
        await addCartLine({
          sourceType: EVENT_SOURCE_TYPE,
          sourceId: event.id,
          variantId: ticketType.id,
          options: {},
          quantity: quantities[ticketType.id] ?? 0,
        }).unwrap();
      }
      alert.success(`${selectedCount} ticket${selectedCount === 1 ? '' : 's'} for ${event.title} added to your cart.`, {
        position: ALERT_POSITION,
      });
      setQuantities({});
      setJustAdded(true);
    } catch (error) {
      alert.danger(readApiError(error, 'Could not add these tickets to your cart.').message, { position: ALERT_POSITION });
    }
  };

  const renderTickets = () => {
    if (event.status !== 'on_sale') {
      return (
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          {event.status === 'past' ? 'This event has ended.' : 'Online ticket sales for this event have closed.'}
        </Text>
      );
    }

    return (
      <>
        <DetailBlock title="Tickets">
          <Box flex={{ direction: 'col', gap: 12 }}>
            {event.ticketTypes.map((ticketType) => (
              <Box key={ticketType.id} flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }}>
                <Box flex={{ direction: 'col', gap: 2 }} className="min-w-0">
                  <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
                    {ticketType.name}
                  </Text>
                  <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
                    {formatTicketPrice(ticketType.priceCents)}
                  </Text>
                </Box>
                <QuantityStepper
                  value={quantities[ticketType.id] ?? 0}
                  min={0}
                  max={MAX_TICKETS_PER_TYPE}
                  onChange={(quantity) => setQuantity(ticketType.id, quantity)}
                  disabled={isAdding}
                />
              </Box>
            ))}
          </Box>
          {event.bulkDiscount ? (
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
              Group price: {bulkDiscountSummary(event.bulkDiscount)} (all ticket types combined
              {inCartCount > 0 ? `, including the ${inCartCount} already in your cart` : ''}).
            </Text>
          ) : null}
        </DetailBlock>

        <Divider />

        <Box flex={{ direction: 'col', gap: 4 }}>
          {totalCents < fullPriceCents ? (
            <Box flex={{ direction: 'row', justify: 'between', gap: 8 }}>
              <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
                Group discount
              </Text>
              <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm tabular-nums">
                −{formatCents(fullPriceCents - totalCents)}
              </Text>
            </Box>
          ) : null}
          <Box flex={{ direction: 'row', justify: 'between', gap: 8 }}>
            <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
              Total ({selectedCount} ticket{selectedCount === 1 ? '' : 's'})
            </Text>
            <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold tabular-nums">
              {formatCents(totalCents)}
            </Text>
          </Box>
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
            Online sales close {salesCloseFormatter.format(new Date(event.salesCloseAt))}.
          </Text>
        </Box>

        {currentUser ? (
          <Button
            variant={{ kind: 'filled', color: 'primary' }}
            className="w-full"
            onClick={handleAddToCart}
            disabled={isAdding || selectedCount === 0}
          >
            {isAdding ? 'Adding…' : selectedCount === 0 ? 'Choose your tickets' : 'Add to cart'}
          </Button>
        ) : (
          <Button variant={{ kind: 'filled', color: 'primary' }} className="w-full" onClick={handleAddToCart}>
            Log in to buy tickets
          </Button>
        )}
        {justAdded || inCartCount > 0 ? (
          <Button variant={{ kind: 'outlined', color: 'primary' }} className="w-full" onClick={() => navigate('/cart')}>
            View cart &amp; check out
          </Button>
        ) : null}
      </>
    );
  };

  return (
    <Box flex={{ direction: 'col' }} className="w-full">
      <ProgramBanner program={{ id: event.id, name: event.title, imageUrl: event.imageUrl, banner: event.banner }} />

      <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }} className="mx-auto w-full max-w-5xl">
        <Breadcrumbs items={[{ label: 'Events', to: '/events' }, { label: event.title }]} />

        <Box flex={{ direction: 'col', gap: 8 }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm font-semibold uppercase tracking-wide">
            {formatEventDateShort(event.date)}
          </Text>
          <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-3xl font-bold">
            {event.title}
          </Text>
        </Box>

        <Box className="grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">
          <Box flex={{ direction: 'col', gap: 20 }}>
            <DetailBlock title="When">
              <Text as="p" textColor={{ color: 'surface', intensity: 800 }}>
                {formatEventDateLong(event.date)}
              </Text>
              <Text as="p" textColor={{ color: 'surface', intensity: 800 }}>
                {formatEventTimes(event)}
                {event.doorsOpenTime ? ` · Doors open ${formatTime12h(event.doorsOpenTime)}` : ''}
              </Text>
            </DetailBlock>
            <DetailBlock title="Where">
              <Text as="p" textColor={{ color: 'surface', intensity: 800 }} className="font-medium">
                {venue.name}
              </Text>
              {venue.address ? (
                <a
                  href={googleMapsLink(venue.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-surface-800 underline-offset-4 hover:text-accent-500 hover:underline"
                >
                  {venue.address}
                </a>
              ) : null}
            </DetailBlock>
            {event.description ? (
              <DetailBlock title="About">
                <Text as="p" textColor={{ color: 'surface', intensity: 800 }} className="whitespace-pre-line">
                  {event.description}
                </Text>
              </DetailBlock>
            ) : null}
            {event.attendeeNotes ? (
              <DetailBlock title="Good to know">
                <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="whitespace-pre-line text-sm">
                  {event.attendeeNotes}
                </Text>
              </DetailBlock>
            ) : null}
          </Box>

          <Box
            flex={{ direction: 'col', gap: 20 }}
            bgColor={{ color: 'surface', intensity: 100 }}
            borderColor={{ color: 'surface', intensity: 300 }}
            className="h-fit rounded-lg border p-5"
          >
            {renderTickets()}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default EventDetailPage;
