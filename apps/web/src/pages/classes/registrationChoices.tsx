import type { ReactNode } from 'react';
import { Box, Text } from '@inithium/ui';
import type { ClassAttendeeDto } from '@inithium/api-client';

// Shared by the class and workshop detail pages' registration panels.

export const DetailBlock = ({ title, children }: { title: string; children: ReactNode }) => (
  <Box flex={{ direction: 'col', gap: 6 }}>
    <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-semibold">
      {title}
    </Text>
    {children}
  </Box>
);

export interface ChoiceCardProps {
  readonly name: string;
  readonly value: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly type?: 'radio' | 'checkbox';
  readonly onSelect: (value: string) => void;
  readonly children: ReactNode;
}

// A native radio (or checkbox) styled as a selectable card, so keyboard and screen-reader behavior
// come for free while the whole card stays the click target.
export const ChoiceCard = ({ name, value, checked, disabled, type = 'radio', onSelect, children }: ChoiceCardProps) => (
  <label
    className={[
      'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500',
      checked ? 'border-primary-500 bg-primary-500/10' : 'border-surface-300 hover:border-surface-500',
      disabled ? 'cursor-not-allowed opacity-60' : '',
    ].join(' ')}
  >
    <input
      type={type}
      name={name}
      value={value}
      checked={checked}
      disabled={disabled}
      onChange={() => onSelect(value)}
      className="mt-1 accent-primary-500"
    />
    <span className="flex min-w-0 flex-1 flex-col gap-1">{children}</span>
  </label>
);

export const attendeeKeyOf = (attendee: ClassAttendeeDto): string => (attendee.type === 'self' ? 'self' : attendee.childId);

export interface AttendeeChoicesProps {
  readonly attendees: ClassAttendeeDto[];
  readonly selectedKey: string | undefined;
  readonly onSelect: (key: string) => void;
}

export const AttendeeChoices = ({ attendees, selectedKey, onSelect }: AttendeeChoicesProps) => (
  <div role="radiogroup" aria-label="Dancer" className="flex flex-col gap-2">
    {attendees.map((attendee) => (
      <ChoiceCard
        key={attendeeKeyOf(attendee)}
        name="attendee"
        value={attendeeKeyOf(attendee)}
        checked={attendeeKeyOf(attendee) === selectedKey}
        onSelect={onSelect}
      >
        <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
          {attendee.name}
        </Text>
        {attendee.type === 'self' ? (
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
            You
          </Text>
        ) : null}
      </ChoiceCard>
    ))}
  </div>
);
