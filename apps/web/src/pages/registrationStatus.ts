// Shared by CourseDetailPage's ClassVariantCard and WorkshopsPage's WorkshopCard - the state a
// Register button reflects, distinct from *visibility* (a fully-ended offering is filtered out of
// the public catalog server-side entirely, not shown with a "closed" button - see
// class.repository.ts/workshop.repository.ts's own findPublished). "closed" here covers the
// defensive fallback (should rarely reach the client, given that server-side filtering) and a
// Workshop whose first occurrence has already begun (see getWorkshopRegistrationStatus).
export type RegistrationStatus = 'not-yet-open' | 'open' | 'full' | 'closed';

interface ClassRegistrationInput {
  readonly effectiveRegistrationOpensAt?: string;
  readonly endDate: string;
  readonly enrolled: number;
  readonly capacity: number;
}

// Per the studio's own rule: a class that has already started can still be registered for as
// long as it hasn't ended and isn't full - there's no separate "registration closes" date, the
// window is simply [effectiveRegistrationOpensAt, endDate].
export const getClassRegistrationStatus = (classItem: ClassRegistrationInput): RegistrationStatus => {
  const now = Date.now();
  if (new Date(classItem.endDate).getTime() < now) return 'closed';
  if (classItem.effectiveRegistrationOpensAt && new Date(classItem.effectiveRegistrationOpensAt).getTime() > now) return 'not-yet-open';
  if (classItem.enrolled >= classItem.capacity) return 'full';
  return 'open';
};

interface WorkshopRegistrationInput {
  readonly effectiveRegistrationOpensAt?: string;
  readonly occurrences: readonly { date: string }[];
  readonly enrolled: number;
  readonly capacity: number;
}

// Unlike Class, a Workshop's registration window closes once its FIRST occurrence begins - a
// multi-day intensive isn't something to join partway through the way an ongoing weekly class is.
export const getWorkshopRegistrationStatus = (workshop: WorkshopRegistrationInput): RegistrationStatus => {
  const now = Date.now();
  if (workshop.occurrences.length === 0) return 'closed';
  const firstOccurrence = Math.min(...workshop.occurrences.map((occurrence) => new Date(occurrence.date).getTime()));
  if (firstOccurrence < now) return 'closed';
  if (workshop.effectiveRegistrationOpensAt && new Date(workshop.effectiveRegistrationOpensAt).getTime() > now) return 'not-yet-open';
  if (workshop.enrolled >= workshop.capacity) return 'full';
  return 'open';
};

export interface ContactMessage {
  readonly subject: string;
  readonly body: string;
}

// 'full' and 'closed' both route their Register button to the Contact page instead of dead-ending
// in a disabled state (see RegistrationButton.tsx) - a parent may still want to ask about a
// waitlist, a cancellation, or a late add. The prefilled copy is deliberately framed as an
// explicit exception request ("I know I shouldn't be able to, but...") rather than a normal
// registration inquiry - it should never read as if the class is actually still open.
const buildExceptionSubject = (displayName: string): string => `Enrollment Exception Request: ${displayName}`;

const buildExceptionBody = (displayName: string, context: string, reason: string): string =>
  `Hello,\n\nI understand that ${reason}, so I realize I may not be able to register right now. I wanted to reach out anyway to ask if it might be possible to make an exception and still enroll my student in ${displayName}${context}.\n\nThank you!`;

export const buildClassFullContactMessage = (displayName: string, courseName: string, semesterName: string): ContactMessage => ({
  subject: buildExceptionSubject(displayName),
  body: buildExceptionBody(displayName, `, part of ${courseName} (${semesterName})`, 'this class is currently full'),
});

export const buildClassClosedContactMessage = (displayName: string, courseName: string, semesterName: string): ContactMessage => ({
  subject: buildExceptionSubject(displayName),
  body: buildExceptionBody(displayName, `, part of ${courseName} (${semesterName})`, 'the registration window for this class has closed'),
});

export const buildWorkshopFullContactMessage = (name: string, semesterName: string): ContactMessage => ({
  subject: buildExceptionSubject(name),
  body: buildExceptionBody(name, ` (${semesterName})`, 'this workshop is currently full'),
});

export const buildWorkshopClosedContactMessage = (name: string, semesterName: string): ContactMessage => ({
  subject: buildExceptionSubject(name),
  body: buildExceptionBody(name, ` (${semesterName})`, 'the registration window for this workshop has closed'),
});
