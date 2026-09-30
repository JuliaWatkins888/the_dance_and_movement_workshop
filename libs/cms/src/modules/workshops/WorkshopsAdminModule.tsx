import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Box, Button, IconButton, Pill, Text, alert, dialog } from '@inithium/ui';
import {
  formatMoney,
  readApiError,
  useDeleteWorkshopMutation,
  useListWorkshopStaffOptionsQuery,
  useListWorkshopsAdminQuery,
} from '@inithium/api-client';
import type { WorkshopDto, WorkshopStaffOptionDto } from '@inithium/api-client';
import { DIALOG_WIDTH_WIDE, EmptyState, useStoreCurrency } from '../ecommerce/shared';
import { ALERT_POSITION, DIALOG_WIDTH, formatAgeRange, formatTime12h } from '../classes/classAdmin.shared';
import { WorkshopEditDialog } from './WorkshopEditDialog';
import { WorkshopRosterDialog } from './WorkshopRosterDialog';
import { formatWorkshopDay, isPastWorkshop } from './workshopAdmin.shared';

const instructorNames = (workshop: WorkshopDto, staffById: Map<string, WorkshopStaffOptionDto>): string =>
  workshop.instructors
    .map((instructor) => (instructor.type === 'guest' ? `${instructor.name} (guest)` : staffById.get(instructor.staffId)?.name))
    .filter(Boolean)
    .join(', ') || 'No instructor';

const WorkshopRow = ({
  workshop,
  staffById,
  currency,
  onEdit,
  onRoster,
  onDelete,
}: {
  readonly workshop: WorkshopDto;
  readonly staffById: Map<string, WorkshopStaffOptionDto>;
  readonly currency: string;
  readonly onEdit: () => void;
  readonly onRoster: () => void;
  readonly onDelete: () => void;
}) => {
  const ageRange = formatAgeRange(workshop.minAgeYears, workshop.maxAgeYears);
  const pricing = [
    `${formatMoney(workshop.pricePerDayCents, currency)}/day`,
    workshop.fullWorkshopDiscountPercent > 0 ? `${workshop.fullWorkshopDiscountPercent}% off all days` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Box flex={{ direction: 'col', gap: 10 }} borderColor={{ color: 'surface', intensity: 300 }} className="rounded-lg border p-4">
      <Box flex={{ direction: 'row', justify: 'between', align: 'start', gap: 12 }} className="flex-wrap">
        <Box flex={{ direction: 'col', gap: 4 }} className="min-w-0">
          <Box flex={{ direction: 'row', align: 'center', gap: 8 }} className="flex-wrap">
            <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-bold">
              {workshop.title}
            </Text>
            {!workshop.isPublished ? (
              <Pill color={{ color: 'surface', intensity: 300 }} className="text-surface-900">
                Draft
              </Pill>
            ) : null}
          </Box>
          <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
            {[instructorNames(workshop, staffById), ageRange, pricing].filter(Boolean).join(' · ')}
          </Text>
        </Box>
        <Box flex={{ direction: 'row', align: 'center', gap: 4 }}>
          <Button variant={{ kind: 'outlined', color: 'primary' }} onClick={onRoster}>
            Registrations ({workshop.registrationCount})
          </Button>
          <IconButton icon="PencilSimple" label={`Edit ${workshop.title}`} onClick={onEdit} />
          <IconButton icon="Trash" label={`Delete ${workshop.title}`} textColor={{ color: 'red', intensity: 600 }} onClick={onDelete} />
        </Box>
      </Box>

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {workshop.days.map((day) => (
          <Box
            key={day.id}
            flex={{
              direction: 'row',
              justify: 'between',
              align: 'center',
              gap: 8,
            }}
            borderColor={{ color: 'surface', intensity: 200 }}
            padding={{ left: 12, right: 12, top: 6, bottom: 6 }}
            className="border-b last:border-b-0"
          >
            <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
              {formatWorkshopDay(day.date)} · {formatTime12h(day.startTime)}–{formatTime12h(day.endTime)}
              {day.agenda ? ' · agenda set' : ''}
            </Text>
            <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="shrink-0 text-sm tabular-nums">
              {day.enrolled}/{day.capacity} registered
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export const WorkshopsAdminModule = () => {
  const currency = useStoreCurrency();
  const { data: workshops = [], isLoading } = useListWorkshopsAdminQuery();
  const { data: staffOptions = [] } = useListWorkshopStaffOptionsQuery();
  const [deleteWorkshop] = useDeleteWorkshopMutation();

  const staffById = useMemo(() => new Map(staffOptions.map((staff) => [staff.id, staff])), [staffOptions]);
  const knownStyles = useMemo(() => [...new Set(workshops.flatMap((workshop) => workshop.styles))].sort(), [workshops]);
  const now = new Date();
  // The API returns newest first; upcoming reads better soonest first.
  const upcoming = workshops.filter((workshop) => !isPastWorkshop(workshop, now)).reverse();
  const past = workshops.filter((workshop) => isPastWorkshop(workshop, now));

  const openDialog = (title: string, width: number | string, render: (close: () => void) => ReactElement) => {
    const id = dialog.show(() => render(() => dialog.close(id)), {
      title,
      width,
    });
  };

  const openEditDialog = (workshop?: WorkshopDto) =>
    openDialog(workshop ? `Edit "${workshop.title}"` : 'New Workshop', DIALOG_WIDTH_WIDE, (close) => (
      <WorkshopEditDialog workshop={workshop} knownStyles={knownStyles} onDone={close} />
    ));

  const openRoster = (workshop: WorkshopDto) =>
    openDialog(`Registrations - ${workshop.title}`, DIALOG_WIDTH, (close) => <WorkshopRosterDialog workshop={workshop} onDone={close} />);

  const handleDelete = async (workshop: WorkshopDto) => {
    if (workshop.registrationCount > 0) {
      alert.danger(`"${workshop.title}" has registrations, so it can’t be deleted. Unpublish it instead to hide it from the site.`, {
        position: ALERT_POSITION,
      });
      return;
    }
    const confirmed = await dialog.confirm({
      title: 'Delete this workshop?',
      description: `This permanently removes "${workshop.title}".`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    try {
      await deleteWorkshop(workshop.id).unwrap();
    } catch (error) {
      alert.danger(readApiError(error, 'Could not delete this workshop.').message, { position: ALERT_POSITION });
    }
  };

  const renderRows = (list: WorkshopDto[]) =>
    list.map((workshop) => (
      <WorkshopRow
        key={workshop.id}
        workshop={workshop}
        staffById={staffById}
        currency={currency}
        onEdit={() => openEditDialog(workshop)}
        onRoster={() => openRoster(workshop)}
        onDelete={() => handleDelete(workshop)}
      />
    ));

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box
        flex={{
          direction: 'row',
          justify: 'between',
          align: 'center',
          gap: 12,
        }}
        className="flex-wrap"
      >
        <Box flex={{ direction: 'col', gap: 4 }}>
          <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
            Workshops
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="max-w-2xl text-sm">
            One-off, multi-day events. Each day has its own date, time, capacity, and optional agenda; families pay per day or save by
            booking every day.
          </Text>
        </Box>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => openEditDialog()}>
          Add Workshop
        </Button>
      </Box>

      {isLoading ? <EmptyState message="Loading workshops..." /> : null}
      {!isLoading && workshops.length === 0 ? <EmptyState message="No workshops yet. Add one to get started." /> : null}

      {upcoming.length > 0 ? (
        <Box flex={{ direction: 'col', gap: 12 }}>
          <Text as="h2" textColor={{ color: 'surface', intensity: 700 }} className="text-sm font-semibold uppercase tracking-wide">
            Upcoming &amp; in progress
          </Text>
          {renderRows(upcoming)}
        </Box>
      ) : null}

      {past.length > 0 ? (
        <Box flex={{ direction: 'col', gap: 12 }}>
          <Text as="h2" textColor={{ color: 'surface', intensity: 700 }} className="text-sm font-semibold uppercase tracking-wide">
            Past
          </Text>
          {renderRows(past)}
        </Box>
      ) : null}
    </Box>
  );
};
