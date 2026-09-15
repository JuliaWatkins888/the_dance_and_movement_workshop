import dns from 'node:dns';
import mongoose from 'mongoose';

// Same workaround apps/api/src/main.ts applies before its own connectDatabase() call - this
// environment's default resolver can't answer the mongodb+srv SRV lookup Atlas connection
// strings depend on.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error(
    'MONGO_URI is not set. Run with: node --env-file=.env libs/db/scripts/import-classes.mjs (from the repo root)',
  );
  process.exit(1);
}

// The studio's own public "Openings" feed (tuition, ages, categories, real instructor names) -
// richer and better-typed than the one-time Classes.xlsx export it was cross-checked against, so
// this is the single source of truth for the import rather than the spreadsheet.
const JACKRABBIT_URL = 'https://app.jackrabbitclass.com/jr3.0/Openings/OpeningsJSON?orgID=558395';

// Every current offering in the studio's Jackrabbit account carries a fixed 10-seat capacity -
// confirmed by cross-checking the Classes.xlsx export, whose "Open" + "Size" columns sum to
// exactly 10 on all 59 rows, against this same JSON feed's openings.calculated_openings (which
// matches xlsx's "Open" 1:1). The JSON itself has no separate "total size" field, only seats
// remaining, so capacity/enrolled are derived from that verified constant rather than the feed
// alone. New classes created after this import get an admin-editable capacity via the CMS.
const DEFAULT_CLASS_CAPACITY = 10;

const DAY_KEY_TO_NAME = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};
const WEEKDAY_KEY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const mapMeetingDays = (meetingDays = {}) =>
  WEEKDAY_KEY_ORDER.filter((key) => meetingDays[key]).map((key) => DAY_KEY_TO_NAME[key]);

// Jackrabbit encodes ages as ISO-8601 durations ("P07Y00M" = 7 years) rather than plain numbers,
// and an empty string for "no restriction on this end". Rounds to 2 decimal places so e.g.
// "P02Y06M" (2 years 6 months) becomes a clean 2.5 rather than a long float.
const parseIsoDurationYears = (duration) => {
  if (!duration) return undefined;
  const match = /^P(\d+)Y(\d+)M$/.exec(duration);
  if (!match) return undefined;
  const years = Number(match[1]) + Number(match[2]) / 12;
  return Math.round(years * 100) / 100;
};

// A max_age of "P99Y11M" is Jackrabbit's own "effectively unlimited" convention for adult
// classes - normalized to undefined ("no upper bound") rather than displaying "Ages 18-99.9" on
// a card.
const parseMaxAgeYears = (duration) => {
  const years = parseIsoDurationYears(duration);
  return years === undefined || years >= 90 ? undefined : years;
};

// The MongoDB driver's raw collection.updateOne (unlike Mongoose's own Model.create/
// findByIdAndUpdate, which simply omits unset schema paths) BSON-serializes a JS `undefined`
// property as an actual stored `null` rather than dropping the key - which would leave e.g.
// maxAgeYears: null in the database for an adult class with no upper age bound, breaking every
// `=== undefined` check downstream (ClassesPage's formatAgeRange, the CMS edit dialog's
// `initialClass?.maxAgeYears !== undefined` prefill). Stripping undefined keys before $set keeps
// the field genuinely absent, matching what every other write path in this app already does.
const stripUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));

const toClassDocument = (row, now) => {
  const remainingOpenings = row.openings?.calculated_openings ?? DEFAULT_CLASS_CAPACITY;
  const enrolled = Math.max(0, DEFAULT_CLASS_CAPACITY - remainingOpenings);

  return {
    name: row.name.trim(),
    description: row.description ? row.description.trim() : undefined,
    categories: [row.category1, row.category2, row.category3].map((value) => (value || '').trim()).filter(Boolean),
    instructors: Array.isArray(row.instructors) ? row.instructors : [],
    daysOfWeek: mapMeetingDays(row.meeting_days),
    startTime: row.start_time,
    endTime: row.end_time,
    session: row.session,
    registrationStartDate: row.reg_start_date ? new Date(row.reg_start_date) : undefined,
    startDate: new Date(row.start_date),
    endDate: new Date(row.end_date),
    minAgeYears: parseIsoDurationYears(row.min_age),
    maxAgeYears: parseMaxAgeYears(row.max_age),
    priceAmount: row.tuition?.fee ?? 0,
    billingCycle: row.BillingCycle || 'Monthly',
    capacity: DEFAULT_CLASS_CAPACITY,
    enrolled,
    isPublished: true,
    updatedAt: now,
  };
};

async function main() {
  console.log(`Fetching class data from ${JACKRABBIT_URL} ...`);
  const response = await fetch(JACKRABBIT_URL);
  if (!response.ok) {
    throw new Error(`Jackrabbit request failed: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  if (!payload.success || !Array.isArray(payload.rows)) {
    throw new Error('Unexpected Jackrabbit response shape - expected { success: true, rows: [...] }');
  }

  const now = new Date();
  const documents = payload.rows.map((row) => stripUndefined(toClassDocument(row, now)));

  await mongoose.connect(MONGO_URI);
  const collection = mongoose.connection.collection('classes');

  // Upserted by (name, session, startTime, daysOfWeek) - verified unique across all 59 current
  // rows. NOT (name, session, startDate): a term's start date is set at the session level, so
  // distinct day-sections of the same class within one session (e.g. Mini Movers meets Mon, Tue,
  // Wed, and Thu each as its own offering) can share the very same startDate and collapse into
  // each other under that weaker key - caught by a stray 45-created-instead-of-59 count on the
  // first run of this script, cross-checked against the source JSON directly.
  let created = 0;
  let updated = 0;
  for (const doc of documents) {
    const filter = { name: doc.name, session: doc.session, startTime: doc.startTime, daysOfWeek: doc.daysOfWeek };
    // eslint-disable-next-line no-await-in-loop
    const result = await collection.updateOne(filter, { $set: doc, $setOnInsert: { createdAt: now } }, { upsert: true });
    if (result.upsertedCount > 0) {
      created += 1;
    } else {
      updated += 1;
    }
  }

  console.log(`Imported ${documents.length} classes from Jackrabbit (${created} created, ${updated} updated).`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Import failed:', error);
  process.exitCode = 1;
  return mongoose.disconnect().catch(() => undefined);
});
