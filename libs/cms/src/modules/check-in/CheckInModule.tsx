import { useState } from 'react';
import { Box, Button, Input, Loader, Pill, Select, SelectItem, Text, alert } from '@inithium/ui';
import {
  readApiError,
  useGetCheckInDayQuery,
  useRedeemClassCardMutation,
  useVoidClassCardRedemptionMutation,
} from '@inithium/api-client';
import type { CheckInCardHolderDto, CheckInCardUseDto, CheckInPersonDto, CheckInSessionDto } from '@inithium/api-client';
import { EmptyState } from '../ecommerce/shared';
import { formatTime12h } from '../classes/classAdmin.shared';

const ALERT_POSITION = 'bottom-right' as const;

const longDateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const formatLongDate = (dateKey: string): string => longDateFormatter.format(new Date(`${dateKey}T00:00:00.000Z`));

const attendeeKey = (person: CheckInPersonDto): string =>
  `${person.userId}:${person.attendee.type === 'self' ? 'self' : person.attendee.childId}`;

const classesLeftLabel = (count: number): string => `${count} ${count === 1 ? 'class' : 'classes'} left`;

const ListTitle = ({ children }: { readonly children: string }) => (
  <Text as="h4" textColor={{ color: 'surface', intensity: 800 }} className="text-xs font-semibold uppercase tracking-wide">
    {children}
  </Text>
);

const PersonLine = ({ name, tag }: { readonly name: string; readonly tag?: string }) => (
  <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
    <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm">
      {name}
    </Text>
    {tag ? (
      <Pill color={{ color: 'surface', intensity: 200 }} className="text-surface-900">
        {tag}
      </Pill>
    ) : null}
  </Box>
);

const CardUseLine = ({ use }: { readonly use: CheckInCardUseDto }) => {
  const [voidRedemption, { isLoading }] = useVoidClassCardRedemptionMutation();

  const undo = async () => {
    try {
      const result = await voidRedemption(use.redemptionId).unwrap();
      alert.success(`Undone. ${use.attendee.name} has ${classesLeftLabel(result.card.classesLeft)}.`, { position: ALERT_POSITION });
    } catch (error) {
      alert.danger(readApiError(error, 'Could not undo this check-in.').message, { position: ALERT_POSITION });
    }
  };

  return (
    <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 8 }}>
      <PersonLine name={use.attendee.name} tag={`${use.cardName} · ${classesLeftLabel(use.classesLeft)}`} />
      <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={undo} disabled={isLoading}>
        {isLoading ? 'Undoing…' : 'Undo'}
      </Button>
    </Box>
  );
};

interface CardCheckInProps {
  readonly session: CheckInSessionDto;
  readonly date: string;
  readonly cardHolders: CheckInCardHolderDto[];
}

// Pick an adult with a card and take one class off it for this class date.
const CardCheckIn = ({ session, date, cardHolders }: CardCheckInProps) => {
  const [redeem, { isLoading }] = useRedeemClassCardMutation();
  const [cardId, setCardId] = useState('');
  const checkedIn = new Set(session.cardCheckIns.map(attendeeKey));
  const available = cardHolders.filter((holder) => !checkedIn.has(attendeeKey(holder)));
  const chosen = available.find((holder) => holder.cardId === cardId);

  const useClass = async () => {
    if (!chosen) return;
    try {
      const result = await redeem({ cardId: chosen.cardId, sectionId: session.sectionId, classDate: date }).unwrap();
      alert.success(`${chosen.attendee.name} checked in. ${classesLeftLabel(result.card.classesLeft)}.`, { position: ALERT_POSITION });
      setCardId('');
    } catch (error) {
      alert.danger(readApiError(error, 'Could not check in with this card.').message, { position: ALERT_POSITION });
    }
  };

  if (available.length === 0) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
        {cardHolders.length === 0 ? 'No adults have a class card with classes left.' : 'Every card holder is already checked in.'}
      </Text>
    );
  }

  return (
    <Box flex={{ direction: 'row', wrap: 'wrap', align: 'end', gap: 8 }}>
      <Select label="Check in with a class card" value={cardId} onValueChange={setCardId} placeholder="Choose an adult" className="min-w-64 flex-1">
        {available.map((holder) => (
          <SelectItem key={holder.cardId} value={holder.cardId}>
            {[
              holder.attendee.name,
              holder.attendee.type === 'child' && holder.accountName ? `(account: ${holder.accountName})` : undefined,
              `· ${holder.cardName}`,
              `· ${classesLeftLabel(holder.classesLeft)}`,
            ]
              .filter(Boolean)
              .join(' ')}
          </SelectItem>
        ))}
      </Select>
      <Button variant={{ kind: 'filled', color: 'primary' }} onClick={useClass} disabled={!chosen || isLoading}>
        {isLoading ? 'Checking in…' : chosen ? `Use 1 class (${chosen.classesLeft - 1} left)` : 'Use 1 class'}
      </Button>
    </Box>
  );
};

const SessionCard = ({ session, date, cardHolders }: CardCheckInProps) => {
  const isFull = session.seatsTaken >= session.capacity;
  const nobody = session.registered.length === 0 && session.dropIns.length === 0 && session.cardCheckIns.length === 0;

  return (
    <Box
      flex={{ direction: 'col', gap: 12 }}
      borderColor={{ color: 'surface', intensity: 200 }}
      bgColor={{ color: 'surface', intensity: 100 }}
      padding={{ base: 16 }}
      className="rounded-md border"
    >
      <Box flex={{ direction: 'row', justify: 'between', align: 'start', gap: 12 }} className="flex-wrap">
        <Box flex={{ direction: 'col' }}>
          <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-semibold">
            {`${formatTime12h(session.startTime)}–${formatTime12h(session.endTime)} · ${session.course.name}`}
          </Text>
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
            {[session.programName, session.instructorNames.length > 0 ? `with ${session.instructorNames.join(' & ')}` : undefined]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </Box>
        <Box flex={{ direction: 'row', gap: 8 }}>
          {session.acceptsClassCards ? (
            <Pill color={{ color: 'accent', intensity: 500 }} className="text-accent-foreground-500">
              Takes class cards
            </Pill>
          ) : null}
          <Pill color={{ color: 'surface', intensity: 200 }} className="text-surface-900">
            {isFull ? `Full · ${session.seatsTaken}/${session.capacity}` : `${session.seatsTaken}/${session.capacity} seats`}
          </Pill>
        </Box>
      </Box>

      {nobody ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
          No one is registered for this class yet.
        </Text>
      ) : null}

      {session.registered.length > 0 ? (
        <Box flex={{ direction: 'col', gap: 4 }}>
          <ListTitle>Registered</ListTitle>
          {session.registered.map((person) => (
            <PersonLine key={attendeeKey(person)} name={person.attendee.name} />
          ))}
        </Box>
      ) : null}

      {session.dropIns.length > 0 ? (
        <Box flex={{ direction: 'col', gap: 4 }}>
          <ListTitle>Drop-ins</ListTitle>
          {session.dropIns.map((person) => (
            <PersonLine key={person.dropInId} name={person.attendee.name} tag="Drop-in" />
          ))}
        </Box>
      ) : null}

      {session.cardCheckIns.length > 0 ? (
        <Box flex={{ direction: 'col', gap: 4 }}>
          <ListTitle>Class cards</ListTitle>
          {session.cardCheckIns.map((use) => (
            <CardUseLine key={use.redemptionId} use={use} />
          ))}
        </Box>
      ) : null}

      {session.acceptsClassCards ? <CardCheckIn session={session} date={date} cardHolders={cardHolders} /> : null}
    </Box>
  );
};

export const CheckInModule = () => {
  // Undefined = today in studio time, which the API resolves.
  const [date, setDate] = useState<string | undefined>(undefined);
  const { data, isLoading, isFetching, isError } = useGetCheckInDayQuery(date);

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'end', gap: 12 }} className="flex-wrap">
        <Box flex={{ direction: 'col', gap: 4 }}>
          <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
            Check-in
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
            {data ? formatLongDate(data.date) : 'Today'}
            {isFetching && !isLoading ? ' · refreshing…' : ''}
          </Text>
        </Box>
        <Box flex={{ direction: 'row', align: 'end', gap: 8 }}>
          <Input label="Date" type="date" value={date ?? data?.date ?? ''} onChange={(event) => setDate(event.target.value || undefined)} />
          {date ? (
            <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={() => setDate(undefined)}>
              Today
            </Button>
          ) : null}
        </Box>
      </Box>

      {isLoading ? (
        <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
          <Loader />
        </Box>
      ) : isError || !data ? (
        <EmptyState message="Couldn’t load classes for this date." />
      ) : data.isStudioClosed ? (
        <EmptyState message="The studio is closed on this date, so no classes meet." />
      ) : data.sessions.length === 0 ? (
        <EmptyState message="No classes meet on this date." />
      ) : (
        <Box flex={{ direction: 'col', gap: 12 }}>
          {data.sessions.map((session) => (
            <SessionCard key={session.sectionId} session={session} date={data.date} cardHolders={data.cardHolders} />
          ))}
        </Box>
      )}
    </Box>
  );
};
