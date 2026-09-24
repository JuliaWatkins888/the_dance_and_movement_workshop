import dns from 'node:dns';
import mongoose from 'mongoose';

// Same workaround apps/api/src/main.ts applies before its own connectDatabase() call - this
// environment's default resolver can't answer the mongodb+srv SRV lookup Atlas connection
// strings depend on.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error(
    'MONGO_URI is not set. Run with: node --env-file=.env libs/db/scripts/migrate-to-academic-years.mjs [--dry-run] (from the repo root)',
  );
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

// One-time move from the old Semester -> Course -> Class model to AcademicYear -> Semester -> Course
// -> Class (see libs/db/src/contracts/academic-year.contract.ts):
//   - each old semester becomes one half of an academic year, slotted by its start month
//     (Jun-Dec = summer-fall, Jan-May = winter-spring) and grouped with the other half of that year
//   - a half with no old semester gets an UNPUBLISHED placeholder semester, because every year must
//     have exactly two and the Semesters CMS module can edit but never create
//   - each course's semesterId becomes academicYearId + semesterIds: [semesterId]
//   - each class inherits its course's semesterIds and loses the retired billingCycle field
// Workshops keep their semesterId untouched. Idempotent: rows already migrated are skipped, so a
// re-run after a partial failure just finishes the job. --dry-run prints the plan and writes nothing.

const TERM_LABELS = { 'summer-fall': 'Summer/Fall', 'winter-spring': 'Winter/Spring' };
const TERMS = Object.keys(TERM_LABELS);

const termOf = (startDate) => (startDate.getUTCMonth() >= 5 ? 'summer-fall' : 'winter-spring');
// "Winter/Spring 2027" belongs to the academic year that began the previous summer.
const academicYearStartOf = (startDate) => startDate.getUTCFullYear() - (termOf(startDate) === 'winter-spring' ? 1 : 0);
const titleOf = (startYear) => `${startYear}–${startYear + 1}`;

const placeholderDates = (term, startYear) =>
  term === 'summer-fall'
    ? { startDate: new Date(Date.UTC(startYear, 7, 1)), endDate: new Date(Date.UTC(startYear, 11, 31)) }
    : { startDate: new Date(Date.UTC(startYear + 1, 0, 1)), endDate: new Date(Date.UTC(startYear + 1, 4, 31)) };

const hasValue = (value) => value !== undefined && value !== null && value !== '';

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection;
  const academicYears = db.collection('academicyears');
  const semesters = db.collection('semesters');
  const courses = db.collection('courses');
  const classes = db.collection('classes');
  const now = new Date();

  const allSemesters = await semesters.find({}).toArray();
  const legacySemesters = allSemesters.filter((semester) => !hasValue(semester.academicYearId));

  // ---- plan: which academic year (and slot) each legacy semester lands in
  const existingYears = await academicYears.find({}).toArray();
  const yearsByStartYear = new Map(); // startYear -> { _id, startYear, title, isNew, slots: { term -> semester doc }, anyPublished }
  const getYear = (startYear) => {
    if (!yearsByStartYear.has(startYear)) {
      const title = titleOf(startYear);
      const existing = existingYears.find((year) => year.title === title);
      const slots = {};
      if (existing) {
        for (const semester of allSemesters.filter((candidate) => candidate.academicYearId === String(existing._id))) {
          slots[semester.term] = semester;
        }
      }
      yearsByStartYear.set(startYear, { _id: existing?._id ?? new mongoose.Types.ObjectId(), startYear, title, isNew: !existing, slots, anyPublished: false });
    }
    return yearsByStartYear.get(startYear);
  };

  const conflicts = [];
  const semesterAssignments = []; // { semester, year, term }
  for (const semester of legacySemesters) {
    const term = termOf(new Date(semester.startDate));
    const year = getYear(academicYearStartOf(new Date(semester.startDate)));
    if (year.slots[term]) {
      conflicts.push(`"${semester.name}" and "${year.slots[term].name}" both map to ${TERM_LABELS[term]} of ${year.title}`);
      continue;
    }
    year.slots[term] = semester;
    year.anyPublished ||= semester.isPublished !== false;
    semesterAssignments.push({ semester, year, term });
  }

  if (conflicts.length > 0) {
    console.error('Cannot migrate - more than one old semester maps to the same slot. Merge or remove one of each pair, then re-run:');
    for (const conflict of conflicts) console.error(`  - ${conflict}`);
    await mongoose.disconnect();
    process.exitCode = 1;
    return;
  }

  const placeholders = []; // { year, term, name, dates }
  for (const year of yearsByStartYear.values()) {
    for (const term of TERMS) {
      if (year.slots[term]) continue;
      const dates = placeholderDates(term, year.startYear);
      placeholders.push({ year, term, name: `${TERM_LABELS[term]} ${dates.startDate.getUTCFullYear()}`, ...dates });
    }
  }

  // semesterId (string) -> academicYearId (string), covering both just-assigned and already-migrated rows
  const yearIdBySemesterId = new Map();
  for (const semester of allSemesters) {
    if (hasValue(semester.academicYearId)) yearIdBySemesterId.set(String(semester._id), semester.academicYearId);
  }
  for (const { semester, year } of semesterAssignments) yearIdBySemesterId.set(String(semester._id), String(year._id));

  const legacyCourses = (await courses.find({ semesterId: { $exists: true, $ne: null } }).toArray()).filter((course) => !hasValue(course.academicYearId));
  const courseUpdates = [];
  const orphanCourses = [];
  for (const course of legacyCourses) {
    const academicYearId = yearIdBySemesterId.get(String(course.semesterId));
    if (!academicYearId) {
      orphanCourses.push(course);
      continue;
    }
    courseUpdates.push({ course, academicYearId });
  }

  // courseId (string) -> semesterIds, from both the migration above and courses migrated earlier
  const semesterIdsByCourseId = new Map();
  for (const { course } of courseUpdates) semesterIdsByCourseId.set(String(course._id), [String(course.semesterId)]);
  for (const course of await courses.find({ semesterIds: { $exists: true, $ne: [] } }).toArray()) {
    semesterIdsByCourseId.set(String(course._id), course.semesterIds);
  }

  const allClasses = await classes.find({}).toArray();
  const classUpdates = [];
  const orphanClasses = [];
  for (const classDoc of allClasses) {
    const needsSemesters = !Array.isArray(classDoc.semesterIds) || classDoc.semesterIds.length === 0;
    const hasBillingCycle = 'billingCycle' in classDoc;
    if (!needsSemesters && !hasBillingCycle) continue;

    const semesterIds = needsSemesters ? semesterIdsByCourseId.get(String(classDoc.courseId)) : undefined;
    if (needsSemesters && !semesterIds) {
      orphanClasses.push(classDoc);
      continue;
    }
    classUpdates.push({ classDoc, semesterIds, hasBillingCycle });
  }

  // ---- report
  const newYears = [...yearsByStartYear.values()].filter((year) => year.isNew);
  console.log(DRY_RUN ? 'DRY RUN - nothing will be written.\n' : 'Applying migration.\n');
  console.log(`Academic years to create: ${newYears.length}`);
  for (const year of yearsByStartYear.values()) {
    const parts = TERMS.map((term) => {
      const semester = year.slots[term];
      return semester ? `${TERM_LABELS[term]}: "${semester.name}"` : `${TERM_LABELS[term]}: (placeholder)`;
    });
    console.log(`  ${year.title}${year.isNew ? '' : ' (already exists)'} - ${parts.join(', ')}`);
  }
  console.log(`Old semesters to attach to a year: ${semesterAssignments.length}`);
  console.log(`Placeholder semesters to create (unpublished, dates are guesses - edit them under Semesters): ${placeholders.length}`);
  for (const placeholder of placeholders) {
    console.log(`  ${placeholder.name} in ${placeholder.year.title}`);
  }
  console.log(`Courses to update: ${courseUpdates.length}`);
  console.log(`Classes to update: ${classUpdates.length}`);
  if (orphanCourses.length > 0) {
    console.warn(`\nSkipped ${orphanCourses.length} course(s) whose semester no longer exists (fix or delete them in the CMS):`);
    for (const course of orphanCourses) console.warn(`  - "${course.name}" (semesterId ${course.semesterId})`);
  }
  if (orphanClasses.length > 0) {
    console.warn(`\nSkipped ${orphanClasses.length} class(es) whose course was not migrated (fix or delete them in the CMS):`);
    for (const classDoc of orphanClasses) console.warn(`  - ${classDoc.variantLabel ?? classDoc._id} (courseId ${classDoc.courseId})`);
  }

  if (DRY_RUN) {
    await mongoose.disconnect();
    return;
  }

  // ---- apply
  for (const year of newYears) {
    await academicYears.insertOne({
      _id: year._id,
      title: year.title,
      isPublished: year.anyPublished,
      createdAt: now,
      updatedAt: now,
      __v: 0,
    });
  }
  for (const { semester, year, term } of semesterAssignments) {
    await semesters.updateOne({ _id: semester._id }, { $set: { academicYearId: String(year._id), term, updatedAt: now } });
  }
  for (const placeholder of placeholders) {
    await semesters.insertOne({
      academicYearId: String(placeholder.year._id),
      term: placeholder.term,
      name: placeholder.name,
      startDate: placeholder.startDate,
      endDate: placeholder.endDate,
      isPublished: false,
      createdAt: now,
      updatedAt: now,
      __v: 0,
    });
  }
  for (const { course, academicYearId } of courseUpdates) {
    await courses.updateOne(
      { _id: course._id },
      { $set: { academicYearId, semesterIds: [String(course.semesterId)], updatedAt: now }, $unset: { semesterId: '' } },
    );
  }
  for (const { classDoc, semesterIds, hasBillingCycle } of classUpdates) {
    await classes.updateOne(
      { _id: classDoc._id },
      { $set: { ...(semesterIds ? { semesterIds } : {}), updatedAt: now }, ...(hasBillingCycle ? { $unset: { billingCycle: '' } } : {}) },
    );
  }

  console.log('\nMigration complete.');
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
  return mongoose.disconnect().catch(() => undefined);
});
