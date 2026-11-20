import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { alert, Box, Button, Text, useNavigateWithTransition } from '@inithium/ui';
import {
  CLASS_CARD_SOURCE_TYPE,
  readApiError,
  toClassCardLineOptions,
  useAddCartLineMutation,
  useListClassCardTypesQuery,
  useListEligibleAttendeesQuery,
} from '@inithium/api-client';
import type { CatalogCourseDetailDto, ClassAttendeeDto } from '@inithium/api-client';
import { useCurrentUser } from '../../app/useCurrentUser';
import { loginPathFor } from '../ecommerce/SignInPrompt';
import { formatCents } from './classFormat';
import { AttendeeChoices, ChoiceCard, DetailBlock, attendeeKeyOf } from './registrationChoices';

const ALERT_POSITION = 'bottom-right' as const;
const ADULT_MIN_AGE_YEARS = 18;

export const isAdultCourse = (course: Pick<CatalogCourseDetailDto, 'minAgeYears'>): boolean =>
  course.minAgeYears !== undefined && course.minAgeYears >= ADULT_MIN_AGE_YEARS;

// Prepaid adult classes, offered on every adult course page. Staff take one class off the card at
// check-in, so buying one doesn't pick a time slot.
export const ClassCardOffer = ({ course }: { readonly course: CatalogCourseDetailDto }) => {
  const { data: cardTypes = [] } = useListClassCardTypesQuery();
  const { currentUser } = useCurrentUser();
  const navigate = useNavigateWithTransition();
  const location = useLocation();
  const [addCartLine, { isLoading: isAdding }] = useAddCartLineMutation();
  const [cardTypeId, setCardTypeId] = useState<string | undefined>(undefined);
  const [attendeeKey, setAttendeeKey] = useState<string | undefined>(undefined);

  // Who may take an adult course is exactly who may hold a card: the account holder and 18+ students.
  const firstSectionId = course.sections[0]?.id;
  const { data: eligible } = useListEligibleAttendeesQuery(firstSectionId ?? '', { skip: !currentUser || !firstSectionId });
  const selfOnly: ClassAttendeeDto[] = currentUser ? [{ type: 'self', name: [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') }] : [];
  const attendees = eligible ?? selfOnly;
  // Defaults to the first card and the first eligible person until the shopper picks.
  const attendee = attendees.find((candidate) => attendeeKeyOf(candidate) === attendeeKey) ?? attendees[0];
  const cardType = cardTypes.find((candidate) => candidate.id === cardTypeId) ?? cardTypes[0];

  if (!isAdultCourse(course) || cardTypes.length === 0) return null;

  const handleAdd = async () => {
    if (!currentUser) {
      navigate(loginPathFor(`${location.pathname}${location.search}`));
      return;
    }
    if (!cardType || !attendee) return;
    try {
      await addCartLine({
        sourceType: CLASS_CARD_SOURCE_TYPE,
        sourceId: cardType.id,
        options: toClassCardLineOptions(attendee),
        quantity: 1,
      }).unwrap();
      alert.success(`${cardType.name} for ${attendee.name} added to your cart.`, { position: ALERT_POSITION });
      navigate('/cart');
    } catch (error) {
      alert.danger(readApiError(error, 'Could not add this class card to your cart.').message, { position: ALERT_POSITION });
    }
  };

  return (
    <Box
      flex={{ direction: 'col', gap: 16 }}
      bgColor={{ color: 'surface', intensity: 100 }}
      borderColor={{ color: 'surface', intensity: 300 }}
      className="h-fit rounded-lg border p-5"
    >
      <DetailBlock title="Buy a class card">
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          Prepay for classes and use them in any adult class. Cards never expire. Check in at the front desk and staff take one class
          off your card.
        </Text>
        <div role="radiogroup" aria-label="Class card" className="flex flex-col gap-2">
          {cardTypes.map((candidate) => (
            <ChoiceCard key={candidate.id} name="class-card" value={candidate.id} checked={candidate.id === cardType?.id} onSelect={setCardTypeId}>
              <span className="flex items-baseline justify-between gap-3">
                <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
                  {candidate.name}
                </Text>
                <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
                  {formatCents(candidate.priceCents)}
                </Text>
              </span>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
                {`${candidate.classCount} classes · ${formatCents(Math.round(candidate.priceCents / candidate.classCount))} each`}
              </Text>
            </ChoiceCard>
          ))}
        </div>
      </DetailBlock>

      {currentUser && attendees.length > 1 ? (
        <DetailBlock title="Who is it for?">
          <AttendeeChoices name="class-card-attendee" attendees={attendees} selectedKey={attendee ? attendeeKeyOf(attendee) : undefined} onSelect={setAttendeeKey} />
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
            A card belongs to one adult and can’t be shared.
          </Text>
        </DetailBlock>
      ) : null}

      <Button variant={{ kind: 'outlined', color: 'primary' }} className="w-full" onClick={handleAdd} disabled={isAdding || (Boolean(currentUser) && (!cardType || !attendee))}>
        {isAdding ? 'Adding…' : currentUser ? 'Add class card to cart' : 'Log in to buy a class card'}
      </Button>
    </Box>
  );
};
