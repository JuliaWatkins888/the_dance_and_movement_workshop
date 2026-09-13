// There is no timezone library anywhere in this codebase (Node 20+ ships full ICU, so
// Intl.DateTimeFormat/Intl.supportedValuesOf('timeZone') already cover every zone-aware need this
// plugin has), so converting a wall-clock date/time in an arbitrary IANA zone into the UTC
// instant it corresponds to is done with the standard "round-trip" trick below rather than a new
// dependency: format a UTC guess in the target zone, measure how far that drifted from the
// wall-clock time actually wanted, and correct for it. Two passes safely cover a DST transition
// (which shifts by a whole hour); a zone's offset never moves far enough within one correction
// step to need more.
const formatInZone = (utcMillis: number, timeZone: string): Record<string, string> => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(utcMillis))) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  // hour12: false renders midnight as "24" in some engines - normalize back to "00" so
  // Date.UTC(...) below doesn't roll over into the next day.
  if (parts['hour'] === '24') parts['hour'] = '00';
  return parts;
};

const partsToUtcMillis = (parts: Record<string, string>): number =>
  Date.UTC(
    Number(parts['year']),
    Number(parts['month']) - 1,
    Number(parts['day']),
    Number(parts['hour']),
    Number(parts['minute']),
    Number(parts['second']),
  );

// wallTime is a plain "YYYY-MM-DDTHH:mm" or "YYYY-MM-DDTHH:mm:ss" string with no zone suffix -
// exactly what a native <input type="datetime-local"> produces, and what time.schema.ts's
// localDateTimeString validates. Interpreted as wall-clock time in `timeZone`.
export const zonedWallTimeToUtc = (wallTime: string, timeZone: string): Date => {
  const [datePart, timePart = '00:00:00'] = wallTime.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second = 0] = timePart.split(':').map(Number);
  const desiredMillis = Date.UTC(year, month - 1, day, hour, minute, second);

  let guessMillis = desiredMillis;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const observedMillis = partsToUtcMillis(formatInZone(guessMillis, timeZone));
    const driftMillis = desiredMillis - observedMillis;
    if (driftMillis === 0) break;
    guessMillis += driftMillis;
  }
  return new Date(guessMillis);
};

// The UTC instant for a calendar year's boundaries ([start, end)) as experienced in `timeZone` -
// used by the owner-triggered yearly archive to purge exactly the entries a business would
// consider to belong to that year, not a UTC-calendar approximation of it.
export const zonedYearBoundsToUtc = (year: number, timeZone: string): { from: Date; to: Date } => ({
  from: zonedWallTimeToUtc(`${year}-01-01T00:00:00`, timeZone),
  to: zonedWallTimeToUtc(`${year + 1}-01-01T00:00:00`, timeZone),
});
