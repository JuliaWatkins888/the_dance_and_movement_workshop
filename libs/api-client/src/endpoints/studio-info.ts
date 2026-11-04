import { useMemo } from 'react';
import { useGetPublicSettingQuery } from './settings.endpoints';
import type { SettingEntity } from './settings.endpoints';

export interface StudioHoursEntry {
  readonly day: string;
  // Free text, so "By Appointment Only" and "Closed" work as well as a time range.
  readonly text: string;
  readonly linkUrl?: string;
}

export interface StudioInfo {
  readonly name: string;
  readonly address: string;
  readonly phone: string;
  readonly phoneHref: string;
  readonly email: string;
  // Blank hides that social icon.
  readonly facebookUrl: string;
  readonly instagramUrl: string;
  readonly hours: readonly StudioHoursEntry[];
}

export const STUDIO_HOURS_TEXT_MAX_LENGTH = 60;

// The one copy of the studio's defaults: the CMS setting definitions import these too, so the
// Contact page and the CMS form can't disagree before an admin has saved anything.
export const DEFAULT_STUDIO_INFO: Omit<StudioInfo, 'phoneHref'> = {
  name: 'The Dance and Movement Workshop',
  address: '64007 Van Dyke Rd. Ste. 2, Washington, MI 48095',
  phone: '(248) 495-4756',
  email: 'thedanceandmovementworkshop@gmail.com',
  facebookUrl: 'https://www.facebook.com/thedanceandmovementworkshop?_rdr',
  instagramUrl: 'https://www.instagram.com/thedanceandmovementworkshop/',
  hours: [
    { day: 'Mon', text: '3:00 PM – 8:30 PM' },
    { day: 'Tue', text: '3:00 PM – 8:30 PM' },
    { day: 'Wed', text: '3:00 PM – 8:30 PM' },
    { day: 'Thu', text: '3:00 PM – 8:30 PM' },
    { day: 'Fri', text: '4:30 PM – 7:00 PM' },
    { day: 'Sat', text: '11:00 AM – 3:00 PM' },
    { day: 'Sun', text: 'By Appointment Only', linkUrl: '/contact?subject=Private%20lesson' },
  ],
};

const isHoursEntry = (candidate: unknown): candidate is StudioHoursEntry => {
  const entry = candidate as Partial<StudioHoursEntry> | null;
  return typeof entry?.day === 'string' && typeof entry.text === 'string';
};

// The json setting type must be an object, so the ordered list is stored as { days: [...] }.
export const parseStudioHours = (value: Record<string, unknown> | undefined): readonly StudioHoursEntry[] => {
  const days = value?.['days'];
  return Array.isArray(days) && days.length === DEFAULT_STUDIO_INFO.hours.length && days.every(isHoursEntry)
    ? days
    : DEFAULT_STUDIO_INFO.hours;
};

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

// Mirrors studio.hours in libs/api-core's settings.schema.ts, which is the real enforcement.
const isValidHoursLink = (link: string): boolean =>
  (link.startsWith('/') && !link.startsWith('//') && !/[\t\r\n\\]/.test(link)) || isHttpsUrl(link);

export const studioHoursEntryErrors = (entry: StudioHoursEntry): { text?: string; linkUrl?: string } => {
  const text = entry.text.trim();
  const link = entry.linkUrl?.trim() ?? '';
  return {
    ...(text.length === 0 ? { text: 'Enter hours, or "Closed".' } : {}),
    ...(text.length > STUDIO_HOURS_TEXT_MAX_LENGTH ? { text: `Keep this to ${STUDIO_HOURS_TEXT_MAX_LENGTH} characters.` } : {}),
    ...(link && !isValidHoursLink(link) ? { linkUrl: 'Start with / or https://.' } : {}),
  };
};

const phoneToTelHref = (phone: string): string => `tel:${phone.replace(/\D/g, '')}`;

const readString = (data: SettingEntity | undefined, fallback: string): string =>
  data?.type === 'string' ? data.value : fallback;

// A stored blank is kept rather than falling back, which is how a social icon gets hidden.
export const useStudioInfo = (): StudioInfo => {
  const { data: name } = useGetPublicSettingQuery('studio.name');
  const { data: address } = useGetPublicSettingQuery('studio.address');
  const { data: phone } = useGetPublicSettingQuery('studio.phone');
  const { data: email } = useGetPublicSettingQuery('studio.email');
  const { data: facebookUrl } = useGetPublicSettingQuery('studio.facebookUrl');
  const { data: instagramUrl } = useGetPublicSettingQuery('studio.instagramUrl');
  const { data: hours } = useGetPublicSettingQuery('studio.hours');

  return useMemo(() => {
    const resolvedPhone = readString(phone, DEFAULT_STUDIO_INFO.phone);
    return {
      name: readString(name, DEFAULT_STUDIO_INFO.name),
      address: readString(address, DEFAULT_STUDIO_INFO.address),
      phone: resolvedPhone,
      phoneHref: phoneToTelHref(resolvedPhone),
      email: readString(email, DEFAULT_STUDIO_INFO.email),
      facebookUrl: readString(facebookUrl, DEFAULT_STUDIO_INFO.facebookUrl),
      instagramUrl: readString(instagramUrl, DEFAULT_STUDIO_INFO.instagramUrl),
      hours: parseStudioHours(hours?.type === 'json' ? hours.value : undefined),
    };
  }, [name, address, phone, email, facebookUrl, instagramUrl, hours]);
};
