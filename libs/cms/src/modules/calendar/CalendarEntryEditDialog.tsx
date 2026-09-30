import { useState } from 'react';
import { Box, Button, Input, Switch, Text, Textarea } from '@inithium/ui';
import { readApiError, useCreateCalendarEntryMutation, useUpdateCalendarEntryMutation } from '@inithium/api-client';
import type { CalendarEntryDto, CalendarEntryWriteInput } from '@inithium/api-client';
import { FormError } from '../ecommerce/shared';
import { toDateInputValue } from '../classes/classAdmin.shared';

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

const isValidUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export interface CalendarEntryEditDialogProps {
  readonly entry?: CalendarEntryDto;
  readonly onDone: () => void;
}

export const CalendarEntryEditDialog = ({ entry, onDone }: CalendarEntryEditDialogProps) => {
  const [createEntry, { isLoading: isCreating }] = useCreateCalendarEntryMutation();
  const [updateEntry, { isLoading: isUpdating }] = useUpdateCalendarEntryMutation();
  const isSaving = isCreating || isUpdating;
  const [error, setError] = useState<string | undefined>(undefined);

  const [title, setTitle] = useState(entry?.title ?? '');
  const [description, setDescription] = useState(entry?.description ?? '');
  const [isStudioClosed, setIsStudioClosed] = useState(entry?.isStudioClosed ?? false);
  const [startDate, setStartDate] = useState(toDateInputValue(entry?.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(entry?.endDate));
  const [isAllDay, setIsAllDay] = useState(!entry?.startTime);
  const [startTime, setStartTime] = useState(entry?.startTime ?? '');
  const [endTime, setEndTime] = useState(entry?.endTime ?? '');
  const [isAtStudio, setIsAtStudio] = useState(entry?.isAtStudio ?? true);
  const [venueName, setVenueName] = useState(entry?.venueName ?? '');
  const [venueAddress, setVenueAddress] = useState(entry?.venueAddress ?? '');
  const [linkUrl, setLinkUrl] = useState(entry?.linkUrl ?? '');
  const [isPublished, setIsPublished] = useState(entry?.isPublished ?? true);

  // Closures are always whole days.
  const isTimed = !isStudioClosed && !isAllDay;

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (!endDate || endDate < value) setEndDate(value);
  };

  const validate = (): string | undefined => {
    if (!title.trim()) return 'Title is required.';
    if (!startDate || !endDate) return 'Give the entry a start and end date.';
    if (endDate < startDate) return 'The end date must be on or after the start date.';
    if (isTimed && (!startTime || !endTime)) return 'Give both a start and end time, or mark the entry all day.';
    if (isTimed && startDate === endDate && endTime <= startTime) return 'The end time must be after the start time.';
    if (!isAtStudio && (!venueName.trim() || !venueAddress.trim())) return 'Enter the venue’s name and address.';
    if (linkUrl.trim() && !isValidUrl(linkUrl.trim())) return 'The link must be a full web address starting with https://.';
    return undefined;
  };

  const handleSubmit = async () => {
    setError(undefined);
    const validationError = validate();
    if (validationError) return setError(validationError);

    const input: CalendarEntryWriteInput = {
      title: title.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      startDate,
      endDate,
      ...(isTimed ? { startTime, endTime } : {}),
      isStudioClosed,
      isAtStudio,
      ...(!isAtStudio ? { venueName: venueName.trim(), venueAddress: venueAddress.trim() } : {}),
      ...(linkUrl.trim() ? { linkUrl: linkUrl.trim() } : {}),
      isPublished,
    };

    try {
      if (entry) await updateEntry({ id: entry.id, ...input }).unwrap();
      else await createEntry(input).unwrap();
      onDone();
    } catch (saveError) {
      setError(readApiError(saveError, 'Could not save this calendar entry.').message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <SectionHeading title="Details" />
      <Input
        label="Title"
        required
        placeholder={isStudioClosed ? 'e.g. Closed for Carpet Cleaning' : 'e.g. Meet the Staff Night'}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Textarea label="Description (optional)" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      <Box flex={{ direction: 'col', gap: 4 }}>
        <Switch label="Studio closed" checked={isStudioClosed} onCheckedChange={setIsStudioClosed} />
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          Hides every class session on these dates. Workshops and events already scheduled still show.
        </Text>
      </Box>

      <SectionHeading title="When" />
      <Box className="grid grid-cols-2 gap-3">
        <Input label="Start Date" type="date" required value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} />
        <Input label="End Date" type="date" required value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
      </Box>
      {!isStudioClosed ? (
        <>
          <Switch label="All day" checked={isAllDay} onCheckedChange={setIsAllDay} />
          {!isAllDay ? (
            <Box flex={{ direction: 'col', gap: 4 }}>
              <Box className="grid grid-cols-2 gap-3">
                <Input label="Start Time" type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                <Input label="End Time" type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </Box>
              {startDate && endDate && startDate !== endDate ? (
                <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
                  Runs continuously from the start date’s start time to the end date’s end time.
                </Text>
              ) : null}
            </Box>
          ) : null}
        </>
      ) : null}

      {!isStudioClosed ? (
        <>
          <SectionHeading title="Where" />
          <Switch label="Held at the studio" checked={isAtStudio} onCheckedChange={setIsAtStudio} />
          {!isAtStudio ? (
            <Box className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Venue Name" required value={venueName} onChange={(e) => setVenueName(e.target.value)} />
              <Input label="Venue Address" required value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} />
            </Box>
          ) : null}
        </>
      ) : null}

      <SectionHeading title="Link" hint="Optional - shown as a More Info button, e.g. a sign-up form or a social media event." />
      <Input label="URL" type="url" placeholder="https://" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />

      <Switch label="Published (visible on the public Calendar page)" checked={isPublished} onCheckedChange={setIsPublished} />
      <FormError message={error} />
      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onDone} disabled={isSaving}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};
