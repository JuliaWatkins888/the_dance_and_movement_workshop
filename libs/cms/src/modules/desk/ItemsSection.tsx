import { useMemo, useState } from 'react';
import { Box, Button, Checkbox, IconButton, RadioGroup, RadioGroupItem, Select, SelectItem, Text } from '@inithium/ui';
import {
  CLASS_CARD_SOURCE_TYPE,
  CLASS_SOURCE_TYPE,
  DROP_IN_SOURCE_TYPE,
  WORKSHOP_SOURCE_TYPE,
  formatMoney,
  toClassCardLineOptions,
  toClassLineOptions,
  toDropInLineOptions,
  toWorkshopLineOptions,
  useListClassCardTypesQuery,
  useListClassCatalogQuery,
  useListDropInDatesQuery,
  useListWorkshopsQuery,
} from '@inithium/api-client';
import type { ClassAttendeeDto, ClassPlanOptionDto, DeskAccountDetailDto } from '@inithium/api-client';
import { attendeeKey, attendeeOptions, formatCalendarDay, sectionLabel } from './deskShared';
import type { DeskLine } from './deskShared';

type ItemKind = 'class' | 'drop-in' | 'class-card' | 'workshop';

const planKey = (option: ClassPlanOptionDto): string => (option.kind === 'semester' ? `semester:${option.semesterId}` : option.kind);

const planLabel = (option: ClassPlanOptionDto, currency: string): string => {
  const amount = formatMoney(option.amountCents, currency);
  if (option.kind === 'monthly') return `Monthly · ${amount} a month`;
  const name = option.kind === 'semester' ? (option.semesterName ?? 'Semester') : 'Full year';
  return `${name} · ${amount} paid in full${option.discountPercent ? ` (${option.discountPercent}% off)` : ''}`;
};

interface PickerProps {
  readonly attendees: ClassAttendeeDto[];
  readonly currency: string;
  readonly onAdd: (line: DeskLine) => void;
}

const AttendeeSelect = ({ attendees, value, onChange }: { readonly attendees: ClassAttendeeDto[]; readonly value: string; readonly onChange: (key: string) => void }) => (
  <Select label="Dancer" value={value} onValueChange={onChange} className="min-w-48 flex-1">
    {attendees.map((attendee) => (
      <SelectItem key={attendeeKey(attendee)} value={attendeeKey(attendee)}>
        {attendee.name}
      </SelectItem>
    ))}
  </Select>
);

const ClassPicker = ({ attendees, currency, onAdd }: PickerProps) => {
  const { data: programs = [], isLoading } = useListClassCatalogQuery();
  const courses = useMemo(
    () => programs.flatMap((program) => program.courses.map((course) => ({ ...course, programName: program.name }))),
    [programs],
  );
  const [courseId, setCourseId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [plan, setPlan] = useState('');
  const [attendee, setAttendee] = useState(attendees[0] ? attendeeKey(attendees[0]) : '');

  const course = courses.find((candidate) => candidate.id === courseId);
  const section = course?.sections.find((candidate) => candidate.id === sectionId);
  const option = section?.planOptions.find((candidate) => planKey(candidate) === plan);
  const dancer = attendees.find((candidate) => attendeeKey(candidate) === attendee);

  const chooseCourse = (id: string) => {
    setCourseId(id);
    setSectionId('');
    setPlan('');
  };

  const add = () => {
    if (!course || !section || !option || !dancer) return;
    onAdd({
      key: `class-${section.id}-${planKey(option)}-${attendeeKey(dancer)}`,
      title: `${course.name} · ${sectionLabel(section)}`,
      detail: `${planLabel(option, currency)} · for ${dancer.name}`,
      input: {
        sourceType: CLASS_SOURCE_TYPE,
        sourceId: section.id,
        options: toClassLineOptions(dancer, { kind: option.kind, ...(option.semesterId ? { semesterId: option.semesterId } : {}) }),
        quantity: 1,
      },
    });
    setPlan('');
  };

  if (isLoading) return <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">Loading classes…</Text>;

  return (
    <Box flex={{ direction: 'col', gap: 12 }}>
      <Select label="Class" value={courseId} onValueChange={chooseCourse} placeholder="Choose a class">
        {courses.map((candidate) => (
          <SelectItem key={candidate.id} value={candidate.id}>
            {`${candidate.programName} · ${candidate.name}`}
          </SelectItem>
        ))}
      </Select>
      {course ? (
        <Select label="Section" value={sectionId} onValueChange={(id) => { setSectionId(id); setPlan(''); }} placeholder="Choose a day and time">
          {course.sections.map((candidate) => (
            <SelectItem key={candidate.id} value={candidate.id}>
              {`${sectionLabel(candidate)} · ${candidate.openings > 0 ? `${candidate.openings} open` : 'Full'}`}
            </SelectItem>
          ))}
        </Select>
      ) : null}
      {section ? (
        <Select label="Plan" value={plan} onValueChange={setPlan} placeholder="Choose how they pay">
          {section.planOptions.map((candidate) => (
            <SelectItem key={planKey(candidate)} value={planKey(candidate)}>
              {planLabel(candidate, currency)}
            </SelectItem>
          ))}
        </Select>
      ) : null}
      {section ? (
        <Box flex={{ direction: 'row', wrap: 'wrap', align: 'end', gap: 8 }}>
          <AttendeeSelect attendees={attendees} value={attendee} onChange={setAttendee} />
          <Button variant={{ kind: 'filled', color: 'primary' }} disabled={!option || !dancer} onClick={add}>
            Add class
          </Button>
        </Box>
      ) : null}
      {course && course.sections.length === 0 ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          No sections of this class are open for registration.
        </Text>
      ) : null}
    </Box>
  );
};

const DropInDateSelect = ({ sectionId, value, onChange }: { readonly sectionId: string; readonly value: string; readonly onChange: (date: string) => void }) => {
  const { data, isLoading, isError } = useListDropInDatesQuery({ sectionId });
  if (isLoading) return <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">Loading dates…</Text>;
  if (isError || !data || data.dates.length === 0) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
        No upcoming classes to drop in on in the next six weeks.
      </Text>
    );
  }
  return (
    <Select label="Date" value={value} onValueChange={onChange} placeholder="Choose a class date">
      {data.dates.map(({ date, seatsLeft }) => (
        <SelectItem key={date} value={date} disabled={seatsLeft <= 0}>
          {`${formatCalendarDay(`${date}T00:00:00.000Z`)} · ${seatsLeft > 0 ? `${seatsLeft} open` : 'Full'}`}
        </SelectItem>
      ))}
    </Select>
  );
};

// One class on one date, for courses with a drop-in price. Same eligibility and capacity checks as
// the class page; paid by card or in person like everything else on the order.
const DropInPicker = ({ attendees, currency, onAdd }: PickerProps) => {
  const { data: programs = [], isLoading } = useListClassCatalogQuery();
  const courses = useMemo(
    () =>
      programs.flatMap((program) =>
        program.courses.filter((course) => course.dropInPriceCents !== undefined).map((course) => ({ ...course, programName: program.name })),
      ),
    [programs],
  );
  const [courseId, setCourseId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [date, setDate] = useState('');
  const [attendee, setAttendee] = useState(attendees[0] ? attendeeKey(attendees[0]) : '');

  const course = courses.find((candidate) => candidate.id === courseId);
  const section = course?.sections.find((candidate) => candidate.id === sectionId);
  const dancer = attendees.find((candidate) => attendeeKey(candidate) === attendee);

  const add = () => {
    if (!course || course.dropInPriceCents === undefined || !section || !date || !dancer) return;
    onAdd({
      key: `drop-in-${section.id}-${date}-${attendeeKey(dancer)}`,
      title: `${course.name} · ${sectionLabel(section)}`,
      detail: `Drop-in ${formatCalendarDay(`${date}T00:00:00.000Z`)} · ${formatMoney(course.dropInPriceCents, currency)} · for ${dancer.name}`,
      input: { sourceType: DROP_IN_SOURCE_TYPE, sourceId: section.id, options: toDropInLineOptions(dancer, date), quantity: 1 },
    });
    setDate('');
  };

  if (isLoading) return <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">Loading classes…</Text>;
  if (courses.length === 0) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
        No open class has a drop-in price. Set one on the course in Classes.
      </Text>
    );
  }

  return (
    <Box flex={{ direction: 'col', gap: 12 }}>
      <Select label="Class" value={courseId} onValueChange={(id) => { setCourseId(id); setSectionId(''); setDate(''); }} placeholder="Choose a class">
        {courses.map((candidate) => (
          <SelectItem key={candidate.id} value={candidate.id}>
            {`${candidate.programName} · ${candidate.name}`}
          </SelectItem>
        ))}
      </Select>
      {course ? (
        <Select label="Section" value={sectionId} onValueChange={(id) => { setSectionId(id); setDate(''); }} placeholder="Choose a day and time">
          {course.sections.map((candidate) => (
            <SelectItem key={candidate.id} value={candidate.id}>
              {sectionLabel(candidate)}
            </SelectItem>
          ))}
        </Select>
      ) : null}
      {section ? <DropInDateSelect key={section.id} sectionId={section.id} value={date} onChange={setDate} /> : null}
      {section ? (
        <Box flex={{ direction: 'row', wrap: 'wrap', align: 'end', gap: 8 }}>
          <AttendeeSelect attendees={attendees} value={attendee} onChange={setAttendee} />
          <Button variant={{ kind: 'filled', color: 'primary' }} disabled={!date || !dancer} onClick={add}>
            Add drop-in
          </Button>
        </Box>
      ) : null}
    </Box>
  );
};

// A prepaid card of adult classes, for the account holder or an 18+ student (the API checks the age).
// Staff use its classes from the Check-in screen.
const ClassCardPicker = ({ attendees, currency, onAdd }: PickerProps) => {
  const { data: cardTypes = [], isLoading } = useListClassCardTypesQuery();
  const [cardTypeId, setCardTypeId] = useState('');
  const [attendee, setAttendee] = useState(() => {
    const holder = attendees.find((candidate) => candidate.type === 'self') ?? attendees[0];
    return holder ? attendeeKey(holder) : '';
  });

  const cardType = cardTypes.find((candidate) => candidate.id === cardTypeId);
  const dancer = attendees.find((candidate) => attendeeKey(candidate) === attendee);

  const add = () => {
    if (!cardType || !dancer) return;
    onAdd({
      key: `class-card-${cardType.id}-${attendeeKey(dancer)}`,
      title: cardType.name,
      detail: `${cardType.classCount} adult classes · ${formatMoney(cardType.priceCents, currency)} · for ${dancer.name}`,
      input: { sourceType: CLASS_CARD_SOURCE_TYPE, sourceId: cardType.id, options: toClassCardLineOptions(dancer), quantity: 1 },
    });
    setCardTypeId('');
  };

  if (isLoading) return <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">Loading class cards…</Text>;
  if (cardTypes.length === 0) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
        No class cards are for sale. Add one under Classes → Class Cards.
      </Text>
    );
  }

  return (
    <Box flex={{ direction: 'col', gap: 12 }}>
      <Select label="Card" value={cardTypeId} onValueChange={setCardTypeId} placeholder="Choose a class card">
        {cardTypes.map((candidate) => (
          <SelectItem key={candidate.id} value={candidate.id}>
            {`${candidate.name} · ${candidate.classCount} classes · ${formatMoney(candidate.priceCents, currency)}`}
          </SelectItem>
        ))}
      </Select>
      <Box flex={{ direction: 'row', wrap: 'wrap', align: 'end', gap: 8 }}>
        <AttendeeSelect attendees={attendees} value={attendee} onChange={setAttendee} />
        <Button variant={{ kind: 'filled', color: 'primary' }} disabled={!cardType || !dancer} onClick={add}>
          Add class card
        </Button>
      </Box>
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
        Adults only (18+). The card belongs to the person chosen and never expires.
      </Text>
    </Box>
  );
};

const WorkshopPicker = ({ attendees, currency, onAdd }: PickerProps) => {
  const { data: workshops = [], isLoading } = useListWorkshopsQuery();
  const open = workshops.filter((workshop) => workshop.status === 'open');
  const [workshopId, setWorkshopId] = useState('');
  const [dayIds, setDayIds] = useState<string[]>([]);
  const [attendee, setAttendee] = useState(attendees[0] ? attendeeKey(attendees[0]) : '');

  const workshop = open.find((candidate) => candidate.id === workshopId);
  const dancer = attendees.find((candidate) => attendeeKey(candidate) === attendee);

  const toggleDay = (dayId: string, checked: boolean) =>
    setDayIds(checked ? [...dayIds, dayId] : dayIds.filter((id) => id !== dayId));

  const add = () => {
    if (!workshop || !dancer || dayIds.length === 0) return;
    const options = toWorkshopLineOptions(dancer, workshop, dayIds);
    const isFull = dayIds.length === workshop.days.length;
    onAdd({
      key: `workshop-${workshop.id}-${options['days']}-${attendeeKey(dancer)}`,
      title: workshop.title,
      detail: `${isFull ? 'All days' : workshop.days.filter((day) => dayIds.includes(day.id)).map((day) => formatCalendarDay(day.date)).join(', ')} · for ${dancer.name}`,
      input: { sourceType: WORKSHOP_SOURCE_TYPE, sourceId: workshop.id, options, quantity: 1 },
    });
    setDayIds([]);
  };

  if (isLoading) return <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">Loading workshops…</Text>;
  if (open.length === 0) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
        No workshops are open for registration.
      </Text>
    );
  }

  return (
    <Box flex={{ direction: 'col', gap: 12 }}>
      <Select label="Workshop" value={workshopId} onValueChange={(id) => { setWorkshopId(id); setDayIds([]); }} placeholder="Choose a workshop">
        {open.map((candidate) => (
          <SelectItem key={candidate.id} value={candidate.id}>
            {candidate.title}
          </SelectItem>
        ))}
      </Select>
      {workshop ? (
        <Box flex={{ direction: 'col', gap: 8 }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
            {`Days · ${formatMoney(workshop.pricePerDayCents, currency)} each, ${formatMoney(workshop.fullWorkshopPriceCents, currency)} for all`}
          </Text>
          {workshop.days.map((day) => (
            <Checkbox
              key={day.id}
              label={`${formatCalendarDay(day.date)} · ${day.openings > 0 ? `${day.openings} open` : 'Full'}`}
              checked={dayIds.includes(day.id)}
              onCheckedChange={(checked) => toggleDay(day.id, checked === true)}
            />
          ))}
          <Box flex={{ direction: 'row', wrap: 'wrap', align: 'end', gap: 8 }}>
            <AttendeeSelect attendees={attendees} value={attendee} onChange={setAttendee} />
            <Button variant={{ kind: 'filled', color: 'primary' }} disabled={!dancer || dayIds.length === 0} onClick={add}>
              Add workshop
            </Button>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
};

interface ItemsSectionProps {
  readonly account: DeskAccountDetailDto;
  readonly currency: string;
  readonly lines: DeskLine[];
  // Why the API rejected a line (eligibility, capacity, already registered), by line key.
  readonly lineErrors: Map<string, string>;
  readonly onAdd: (line: DeskLine) => void;
  readonly onRemove: (key: string) => void;
}

export const ItemsSection = ({ account, currency, lines, lineErrors, onAdd, onRemove }: ItemsSectionProps) => {
  const [kind, setKind] = useState<ItemKind>('class');
  const attendees = attendeeOptions(account);

  const add = (line: DeskLine) => {
    if (!lines.some((existing) => existing.key === line.key)) onAdd(line);
  };

  return (
    <Box flex={{ direction: 'col', gap: 12 }}>
      {lines.map((line) => (
        <Box key={line.key} flex={{ direction: 'row', justify: 'between', align: 'start', gap: 8 }} borderColor={{ color: 'surface', intensity: 200 }} padding={{ base: 8 }} className="rounded border">
          <Box flex={{ direction: 'col' }}>
            <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm font-medium">
              {line.title}
            </Text>
            <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
              {line.detail}
            </Text>
            {lineErrors.get(line.key) ? (
              <Text as="span" textColor={{ color: 'red', intensity: 600 }} className="text-sm">
                {lineErrors.get(line.key)}
              </Text>
            ) : null}
          </Box>
          <IconButton icon="Trash" label={`Remove ${line.title}`} textColor={{ color: 'red', intensity: 600 }} onClick={() => onRemove(line.key)} />
        </Box>
      ))}
      <Box borderColor={{ color: 'surface', intensity: 300 }} padding={{ base: 12 }} flex={{ direction: 'col', gap: 12 }} className="rounded-md border">
        <RadioGroup label="Add" value={kind} onValueChange={(value) => setKind(value as ItemKind)} className="flex flex-row gap-6">
          <RadioGroupItem value="class" label="Class" />
          <RadioGroupItem value="drop-in" label="Drop-in" />
          <RadioGroupItem value="class-card" label="Class card" />
          <RadioGroupItem value="workshop" label="Workshop" />
        </RadioGroup>
        {kind === 'class' ? (
          <ClassPicker key={account.id} attendees={attendees} currency={currency} onAdd={add} />
        ) : kind === 'drop-in' ? (
          <DropInPicker key={account.id} attendees={attendees} currency={currency} onAdd={add} />
        ) : kind === 'class-card' ? (
          <ClassCardPicker key={account.id} attendees={attendees} currency={currency} onAdd={add} />
        ) : (
          <WorkshopPicker key={account.id} attendees={attendees} currency={currency} onAdd={add} />
        )}
      </Box>
    </Box>
  );
};
