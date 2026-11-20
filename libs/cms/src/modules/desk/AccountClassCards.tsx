import { Box, Pill, Text } from '@inithium/ui';
import type { ClassCardDto } from '@inithium/api-client';
import { formatCalendarDay, sectionLabel } from './deskShared';

const purchaseFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const CardRow = ({ card }: { readonly card: ClassCardDto }) => {
  const used = card.redemptions.filter((redemption) => redemption.status === 'active');
  return (
    <Box flex={{ direction: 'col', gap: 8 }} borderColor={{ color: 'surface', intensity: 200 }} padding={{ base: 12 }} className="rounded border">
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }}>
        <Box flex={{ direction: 'col' }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
            {`${card.attendee.name} · ${card.name}`}
          </Text>
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
            {`Bought ${purchaseFormatter.format(new Date(card.createdAt))} · ${card.classesUsed} of ${card.classesTotal} used`}
          </Text>
        </Box>
        {card.status === 'cancelled' ? (
          <Pill color={{ color: 'surface', intensity: 300 }} className="text-surface-900">
            Cancelled (refunded)
          </Pill>
        ) : (
          <Pill color={{ color: 'primary', intensity: 500 }} className="text-primary-foreground-500">
            {`${card.classesLeft} left`}
          </Pill>
        )}
      </Box>
      {used.length > 0 ? (
        <Box as="ul" flex={{ direction: 'col', gap: 4 }} className="pl-4">
          {used.map((redemption) => (
            <Text as="li" key={redemption.id} textColor={{ color: 'surface', intensity: 700 }} className="list-disc text-sm">
              {[formatCalendarDay(`${redemption.classDate}T00:00:00.000Z`), redemption.course?.name, redemption.section ? sectionLabel(redemption.section) : undefined]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
};

// An account's class cards with the classes used on each. Staff use classes from Check-in.
export const AccountClassCards = ({ cards }: { readonly cards: ClassCardDto[] }) => (
  <Box flex={{ direction: 'col', gap: 8 }}>
    {cards.map((card) => (
      <CardRow key={card.id} card={card} />
    ))}
  </Box>
);
