import { useMemo, useRef, useState } from 'react';
import {
  Banner,
  BannerEditDialog,
  Box,
  Button,
  IconButton,
  Input,
  Select,
  SelectItem,
  Switch,
  Text,
  Textarea,
  generateSeededBannerConfig,
  useElementSize,
} from '@inithium/ui';
import type { BannerTrianglifyConfig } from '@inithium/ui';
import {
  formatMinorUnitsForInput,
  parseMinorUnitsInput,
  readApiError,
  useCreateEventMutation,
  useUpdateEventMutation,
} from '@inithium/api-client';
import type { EventBulkDiscountKind, EventDto, EventWriteInput, ProgramBannerDto } from '@inithium/api-client';
import { useSessionUploads } from '../../media/useSessionUploads';
import { FormError, MoneyInput, useStoreCurrency } from '../ecommerce/shared';
import { slugify, toDateInputValue } from '../classes/classAdmin.shared';
import { ProgramImageField } from '../classes/ProgramImageField';
import type { ProgramImageFieldHandle, ProgramImageValue } from '../classes/ProgramImageField';

const PREVIEW_HEIGHT = 140;
const DEFAULT_BULK_MIN_TICKETS = 4;

// Local keys keep rows' identity (and input focus) while they're added and removed.
interface TicketTypeDraft {
  key: string;
  id?: string;
  name: string;
  price: string;
}

const nextKey = (): string => crypto.randomUUID();

const toBannerDto = ({ cellSize, variance, xColors, yColors }: BannerTrianglifyConfig): ProgramBannerDto => ({
  cellSize,
  variance,
  xColors: [...xColors],
  yColors: [...yColors],
});

const randomBanner = (): ProgramBannerDto => toBannerDto(generateSeededBannerConfig(crypto.randomUUID()));

const SectionHeading = ({ title, hint }: { title: string; hint?: string }) => (
  <Box flex={{ direction: 'col', gap: 2 }} className="pt-2">
    <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="text-base font-semibold">
      {title}
    </Text>
    {hint ? (
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
        {hint}
      </Text>
    ) : null}
  </Box>
);

export interface EventEditDialogProps {
  readonly event?: EventDto;
  readonly onDone: () => void;
}

export const EventEditDialog = ({ event, onDone }: EventEditDialogProps) => {
  const currency = useStoreCurrency();
  const [createEvent, { isLoading: isCreating }] = useCreateEventMutation();
  const [updateEvent, { isLoading: isUpdating }] = useUpdateEventMutation();
  const isSaving = isCreating || isUpdating;
  const [error, setError] = useState<string | undefined>(undefined);

  const [title, setTitle] = useState(event?.title ?? '');
  const [slug, setSlug] = useState(event?.slug ?? '');
  // A new event's slug follows its title until the admin edits the slug themselves.
  const [slugTouched, setSlugTouched] = useState(Boolean(event));
  const [description, setDescription] = useState(event?.description ?? '');
  const [attendeeNotes, setAttendeeNotes] = useState(event?.attendeeNotes ?? '');
  const [date, setDate] = useState(toDateInputValue(event?.date));
  const [startTime, setStartTime] = useState(event?.startTime ?? '');
  const [endTime, setEndTime] = useState(event?.endTime ?? '');
  const [doorsOpenTime, setDoorsOpenTime] = useState(event?.doorsOpenTime ?? '');
  const [salesCloseDate, setSalesCloseDate] = useState(toDateInputValue(event?.salesCloseDate));
  const [salesCloseTime, setSalesCloseTime] = useState(event?.salesCloseTime ?? '');
  const [isAtStudio, setIsAtStudio] = useState(event?.isAtStudio ?? true);
  const [venueName, setVenueName] = useState(event?.venueName ?? '');
  const [venueAddress, setVenueAddress] = useState(event?.venueAddress ?? '');
  const [ticketTypes, setTicketTypes] = useState<TicketTypeDraft[]>(() =>
    event
      ? event.ticketTypes.map((ticketType) => ({
          key: nextKey(),
          id: ticketType.id,
          name: ticketType.name,
          price: formatMinorUnitsForInput(ticketType.priceCents, currency),
        }))
      : [{ key: nextKey(), name: '', price: '' }],
  );
  const [hasBulkDiscount, setHasBulkDiscount] = useState(Boolean(event?.bulkDiscount));
  const [bulkMinTickets, setBulkMinTickets] = useState(String(event?.bulkDiscount?.minTickets ?? DEFAULT_BULK_MIN_TICKETS));
  const [bulkKind, setBulkKind] = useState<EventBulkDiscountKind>(event?.bulkDiscount?.kind ?? 'percent');
  const [bulkValue, setBulkValue] = useState(
    event?.bulkDiscount
      ? event.bulkDiscount.kind === 'percent'
        ? String(event.bulkDiscount.value)
        : formatMinorUnitsForInput(event.bulkDiscount.value, currency)
      : '',
  );
  const [isPublished, setIsPublished] = useState(event?.isPublished ?? true);

  const [image, setImage] = useState<ProgramImageValue>({
    ...(event?.imageUrl ? { imageUrl: event.imageUrl } : {}),
    ...(event?.imageSourceType ? { imageSourceType: event.imageSourceType } : {}),
    ...(event?.imageAssetId ? { imageAssetId: event.imageAssetId } : {}),
  });
  const imageFieldRef = useRef<ProgramImageFieldHandle>(null);
  const sessionUploads = useSessionUploads();
  // An existing event without a saved mesh keeps its id-derived default (matching the public
  // site); a new one has no id yet, so it gets a concrete mesh up front that's saved with it.
  const [banner, setBanner] = useState<ProgramBannerDto | undefined>(event ? event.banner : randomBanner);
  const [isEditingBanner, setIsEditingBanner] = useState(false);
  const { ref: previewRef, size: previewSize } = useElementSize();

  const previewBanner = useMemo(
    () => (banner as BannerTrianglifyConfig | undefined) ?? generateSeededBannerConfig(event?.id ?? ''),
    [banner, event?.id],
  );

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const updateTicketType = (key: string, patch: Partial<TicketTypeDraft>) =>
    setTicketTypes((previous) => previous.map((ticketType) => (ticketType.key === key ? { ...ticketType, ...patch } : ticketType)));

  const parseBulkValue = (): number | null => {
    if (bulkKind === 'fixed') return parseMinorUnitsInput(bulkValue, currency);
    const percent = Number(bulkValue);
    return Number.isInteger(percent) ? percent : null;
  };

  const validate = (): string | undefined => {
    if (!title.trim()) return 'Title is required.';
    if (!slug.trim()) return 'URL slug is required.';
    if (!date || !startTime) return 'The event needs a date and start time.';
    if (endTime && endTime <= startTime) return 'The end time must be after the start time.';
    if (doorsOpenTime && doorsOpenTime > startTime) return 'Doors must open at or before the start time.';
    if (Boolean(salesCloseDate) !== Boolean(salesCloseTime))
      return 'Give both a date and a time for when ticket sales close, or leave both blank.';
    if (!isAtStudio && (!venueName.trim() || !venueAddress.trim())) return 'Enter the venue’s name and address.';
    if (ticketTypes.length === 0) return 'Add at least one ticket type.';
    if (ticketTypes.some((ticketType) => !ticketType.name.trim())) return 'Every ticket type needs a name.';
    if (ticketTypes.some((ticketType) => parseMinorUnitsInput(ticketType.price, currency) === null)) {
      return 'Every ticket type needs a valid price (0 for free).';
    }
    const names = ticketTypes.map((ticketType) => ticketType.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) return 'Each ticket type needs a different name.';
    if (hasBulkDiscount) {
      const minTickets = Number(bulkMinTickets);
      const value = parseBulkValue();
      if (!Number.isInteger(minTickets) || minTickets < 2) return 'The group discount needs a minimum of at least 2 tickets.';
      if (value === null || value <= 0) return 'Enter the group discount amount.';
      if (bulkKind === 'percent' && value > 100) return 'A percent discount can be at most 100.';
    }
    return undefined;
  };

  const handleSubmit = async () => {
    setError(undefined);
    const validationError = validate();
    if (validationError) return setError(validationError);

    try {
      const finalImage = (await imageFieldRef.current?.finalize()) ?? image;
      if (finalImage.imageAssetId && finalImage.imageAssetId !== event?.imageAssetId) sessionUploads.track(finalImage.imageAssetId);

      const input: EventWriteInput = {
        title: title.trim(),
        slug: slug.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(attendeeNotes.trim() ? { attendeeNotes: attendeeNotes.trim() } : {}),
        date,
        startTime,
        ...(endTime ? { endTime } : {}),
        ...(doorsOpenTime ? { doorsOpenTime } : {}),
        ...(salesCloseDate && salesCloseTime ? { salesCloseDate, salesCloseTime } : {}),
        isAtStudio,
        ...(!isAtStudio ? { venueName: venueName.trim(), venueAddress: venueAddress.trim() } : {}),
        ticketTypes: ticketTypes.map((ticketType) => ({
          ...(ticketType.id ? { id: ticketType.id } : {}),
          name: ticketType.name.trim(),
          priceCents: parseMinorUnitsInput(ticketType.price, currency) ?? 0,
        })),
        ...(hasBulkDiscount ? { bulkDiscount: { minTickets: Number(bulkMinTickets), kind: bulkKind, value: parseBulkValue() ?? 0 } } : {}),
        ...finalImage,
        ...(banner ? { banner } : {}),
        isPublished,
      };

      if (event) await updateEvent({ id: event.id, ...input }).unwrap();
      else await createEvent(input).unwrap();
      sessionUploads.discardUnsaved(finalImage.imageAssetId);
      onDone();
    } catch (saveError) {
      setError(readApiError(saveError, 'Could not save this event.').message);
    }
  };

  // Swaps the form for the shared banner editor; its Save only stages the mesh here - it's
  // written along with the rest of the event when the event itself is saved.
  if (isEditingBanner) {
    return (
      <BannerEditDialog
        initialBanner={toBannerDto(previewBanner)}
        onSave={async ({ cellSize, variance, xColors, yColors }) => setBanner({ cellSize, variance, xColors, yColors })}
        onClose={() => setIsEditingBanner(false)}
      />
    );
  }

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <SectionHeading title="Details" />
      <Input
        label="Title"
        required
        placeholder="e.g. Winter Recital 2026"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
      />
      <Input
        label="URL Slug"
        required
        helperText={`Public page: /events/${slug || '…'}`}
        value={slug}
        onChange={(e) => {
          setSlugTouched(true);
          setSlug(slugify(e.target.value));
        }}
      />
      <Textarea label="Description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />

      <SectionHeading title="When" />
      <Box className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Input label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Start" type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <Input label="End (optional)" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        <Input label="Doors Open (optional)" type="time" value={doorsOpenTime} onChange={(e) => setDoorsOpenTime(e.target.value)} />
      </Box>
      <Box flex={{ direction: 'col', gap: 4 }}>
        <Box className="grid grid-cols-2 gap-3">
          <Input label="Sales Close Date" type="date" value={salesCloseDate} onChange={(e) => setSalesCloseDate(e.target.value)} />
          <Input label="Sales Close Time" type="time" value={salesCloseTime} onChange={(e) => setSalesCloseTime(e.target.value)} />
        </Box>
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          Leave both blank to sell tickets online until the event starts.
        </Text>
      </Box>

      <SectionHeading title="Where" />
      <Switch label="Held at the studio" checked={isAtStudio} onCheckedChange={setIsAtStudio} />
      {!isAtStudio ? (
        <Box className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Venue Name"
            required
            placeholder="e.g. Romeo High School Auditorium"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
          />
          <Input label="Venue Address" required value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} />
        </Box>
      ) : null}

      <SectionHeading
        title="Tickets"
        hint="Each ticket type has its own price - enter 0 for free admission. Promo codes aimed at events also apply."
      />
      {ticketTypes.map((ticketType) => (
        <Box key={ticketType.key} flex={{ direction: 'row', gap: 8, align: 'end' }}>
          <Input
            label="Ticket Type"
            required
            placeholder="e.g. Adult"
            value={ticketType.name}
            onChange={(e) => updateTicketType(ticketType.key, { name: e.target.value })}
            className="flex-1"
          />
          <MoneyInput
            label="Price"
            required
            currency={currency}
            value={ticketType.price}
            onChange={(price) => updateTicketType(ticketType.key, { price })}
            className="flex-1"
          />
          <IconButton
            icon="Trash"
            label={`Remove ${ticketType.name || 'ticket type'}`}
            textColor={{ color: 'red', intensity: 600 }}
            disabled={ticketTypes.length === 1}
            onClick={() => setTicketTypes((previous) => previous.filter((candidate) => candidate.key !== ticketType.key))}
            className="mb-1"
          />
        </Box>
      ))}
      <Box>
        <Button
          variant={{ kind: 'outlined', color: 'primary' }}
          onClick={() => setTicketTypes((previous) => [...previous, { key: nextKey(), name: '', price: '' }])}
        >
          Add Ticket Type
        </Button>
      </Box>

      <Switch label="Offer a group discount when buying several tickets" checked={hasBulkDiscount} onCheckedChange={setHasBulkDiscount} />
      {hasBulkDiscount ? (
        <Box flex={{ direction: 'col', gap: 4 }}>
          <Box className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Minimum Tickets"
              type="number"
              min={2}
              step="1"
              required
              value={bulkMinTickets}
              onChange={(e) => setBulkMinTickets(e.target.value)}
            />
            <Select label="Discount Type" value={bulkKind} onValueChange={(value) => setBulkKind(value as EventBulkDiscountKind)}>
              <SelectItem value="percent">Percent off each ticket</SelectItem>
              <SelectItem value="fixed">Amount off each ticket</SelectItem>
            </Select>
            {bulkKind === 'percent' ? (
              <Input
                label="Percent Off"
                type="number"
                min={1}
                max={100}
                step="1"
                required
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
              />
            ) : (
              <MoneyInput label="Amount Off" required currency={currency} value={bulkValue} onChange={setBulkValue} />
            )}
          </Box>
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
            Counted across all ticket types together. Every ticket in the purchase gets the discount, and none goes below free.
          </Text>
        </Box>
      ) : null}

      <SectionHeading title="Good to Know" />
      <Textarea
        label="Attendee Notes (optional)"
        rows={3}
        placeholder="e.g. Parking is in the rear lot. Flash photography isn’t allowed during the performance."
        value={attendeeNotes}
        onChange={(e) => setAttendeeNotes(e.target.value)}
      />

      <SectionHeading title="Card & Banner" />
      <div ref={previewRef} className="w-full overflow-hidden rounded-md">
        <Banner
          imageUrl={image.imageUrl}
          imageAlt={title}
          trianglifyConfig={previewBanner}
          width={previewSize?.width ?? '100%'}
          height={PREVIEW_HEIGHT}
        />
      </div>
      <ProgramImageField ref={imageFieldRef} purpose="event" value={image} onChange={setImage} />
      <Box flex={{ direction: 'col', gap: 8 }}>
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          Without an image, the card and event page show this generated pattern.
        </Text>
        <Box flex={{ direction: 'row', gap: 8 }} className="flex-wrap">
          <Button variant={{ kind: 'outlined', color: 'primary' }} onClick={() => setIsEditingBanner(true)}>
            Customize Placeholder
          </Button>
          <Button variant={{ kind: 'ghost', color: 'primary' }} onClick={() => setBanner(randomBanner())}>
            Randomize
          </Button>
        </Box>
      </Box>

      <Switch label="Published (visible on the public Events page)" checked={isPublished} onCheckedChange={setIsPublished} />
      <FormError message={error} />
      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button
          variant={{ kind: 'ghost', color: 'surface' }}
          onClick={() => {
            sessionUploads.discardUnsaved();
            onDone();
          }}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};
