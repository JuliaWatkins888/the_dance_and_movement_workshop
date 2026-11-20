import { Box, Divider, Pill, Text } from '@inithium/ui';
import type { ClassCardDto } from '@inithium/api-client';
import { formatClassDate, formatTimeRange } from '../../classes/classFormat';

const purchaseFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const ClassCardRow = ({ card }: { readonly card: ClassCardDto }) => {
  const used = card.redemptions.filter((redemption) => redemption.status === 'active');
  const isCancelled = card.status === 'cancelled';
  return (
    <Box flex={{ direction: 'col', gap: 8 }} padding={{ top: 16, bottom: 16 }}>
      <Box flex={{ direction: 'row', align: 'start', gap: 16 }} className="flex-wrap sm:flex-nowrap">
        <Box flex={{ direction: 'col', gap: 4 }} className="min-w-0 flex-1">
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
            {card.name}
          </Text>
          <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
            {`${card.attendee.name} · ${card.classesUsed} of ${card.classesTotal} classes used`}
          </Text>
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
            {`Bought ${purchaseFormatter.format(new Date(card.createdAt))} · never expires · any adult class`}
          </Text>
        </Box>
        {isCancelled ? (
          <Pill color={{ color: 'surface', intensity: 300 }} className="shrink-0 text-surface-800">
            Refunded
          </Pill>
        ) : (
          <Pill
            color={card.classesLeft > 0 ? { color: 'primary', intensity: 500 } : { color: 'surface', intensity: 300 }}
            className={card.classesLeft > 0 ? 'shrink-0 text-primary-foreground-500' : 'shrink-0 text-surface-800'}
          >
            {card.classesLeft > 0 ? `${card.classesLeft} ${card.classesLeft === 1 ? 'class' : 'classes'} left` : 'All used'}
          </Pill>
        )}
      </Box>
      {used.length > 0 ? (
        <Box as="ul" flex={{ direction: 'col', gap: 2 }} className="pl-5">
          {used.map((redemption) => (
            <Text as="li" key={redemption.id} textColor={{ color: 'surface', intensity: 700 }} className="list-disc text-sm">
              {[
                formatClassDate(redemption.classDate),
                redemption.course?.name,
                redemption.section ? formatTimeRange(redemption.section.startTime, redemption.section.endTime) : undefined,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
};

// Remaining classes and where each was used. Classes come off at check-in at the studio.
export const ClassCardsList = ({ cards }: { readonly cards: ClassCardDto[] }) => (
  <Box flex={{ direction: 'col', gap: 4 }}>
    <Text as="h3" textColor={{ color: 'surface', intensity: 700 }} className="text-sm font-semibold uppercase tracking-wide">
      Class Cards
    </Text>
    <Box>
      {cards.map((card, index) => (
        <Box key={card.id}>
          {index > 0 ? <Divider color={{ color: 'surface', intensity: 300 }} /> : null}
          <ClassCardRow card={card} />
        </Box>
      ))}
    </Box>
  </Box>
);
