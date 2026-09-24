import type { CopyClassPreviewDto, CopyCourseEntryInput, CopyCoursePreviewDto, OfferingCopyPreviewDto } from '@inithium/api-client';

// What's ticked in the copy wizard, and the pure rules for changing it. Kept out of the component so
// the rules (which classes are eligible, what a tick pulls in, what the request looks like) live in
// one place and the React only wires clicks to these functions.

// A course that already has a match in the destination year can either be merged into that match or
// copied as a separate second course. Without a match there's only "create".
export type CopyTargetMode = 'existing' | 'create';

export interface CopySelectionState {
  readonly courseIds: ReadonlySet<string>;
  readonly classIds: ReadonlySet<string>;
  // Only consulted for a course with a destination match; absent means the default, 'existing'.
  readonly targetModes: Readonly<Record<string, CopyTargetMode>>;
}

export const EMPTY_SELECTION: CopySelectionState = { courseIds: new Set(), classIds: new Set(), targetModes: {} };

export const getTargetMode = (course: CopyCoursePreviewDto, state: CopySelectionState): CopyTargetMode =>
  course.destinationMatch ? (state.targetModes[course.id] ?? 'existing') : 'create';

export interface ClassAvailability {
  readonly selectable: boolean;
  readonly reason?: string;
}

// Mirrors what the server would accept (offering-copy.route.ts), so the wizard never offers a tick
// the copy would only skip. Only merging into an existing course restricts anything: a brand-new
// course is created with the source's own scope, so all of its classes fit.
export const getClassAvailability = (course: CopyCoursePreviewDto, classItem: CopyClassPreviewDto, mode: CopyTargetMode): ClassAvailability => {
  if (!course.canCopy) return { selectable: false, reason: course.cannotCopyReason };
  if (mode === 'existing' && course.destinationMatch) {
    if (classItem.alreadyCopied) return { selectable: false, reason: 'Already copied' };
    const allowedTerms = new Set(course.destinationMatch.semesters.map((semester) => semester.term));
    if (!classItem.semesters.every((semester) => allowedTerms.has(semester.term))) {
      return { selectable: false, reason: "Runs in a semester the existing course doesn't" };
    }
  }
  return { selectable: true };
};

const selectableClasses = (course: CopyCoursePreviewDto, mode: CopyTargetMode): CopyClassPreviewDto[] =>
  course.classes.filter((classItem) => getClassAvailability(course, classItem, mode).selectable);

// What ticking a course brings along: every eligible class that hasn't been copied already.
const defaultClassIds = (course: CopyCoursePreviewDto, mode: CopyTargetMode): string[] =>
  selectableClasses(course, mode)
    .filter((classItem) => !classItem.alreadyCopied)
    .map((classItem) => classItem.id);

const withCourse = (state: CopySelectionState, courseId: string, selected: boolean): ReadonlySet<string> => {
  const next = new Set(state.courseIds);
  if (selected) next.add(courseId);
  else next.delete(courseId);
  return next;
};

const withClasses = (state: CopySelectionState, classIds: readonly string[], selected: boolean): ReadonlySet<string> => {
  const next = new Set(state.classIds);
  for (const classId of classIds) {
    if (selected) next.add(classId);
    else next.delete(classId);
  }
  return next;
};

export const toggleCourse = (state: CopySelectionState, course: CopyCoursePreviewDto, checked: boolean): CopySelectionState => {
  if (!course.canCopy) return state;
  if (!checked) {
    return { ...state, courseIds: withCourse(state, course.id, false), classIds: withClasses(state, course.classes.map((classItem) => classItem.id), false) };
  }
  return {
    ...state,
    courseIds: withCourse(state, course.id, true),
    classIds: withClasses(state, defaultClassIds(course, getTargetMode(course, state)), true),
  };
};

// Ticking a class means its course comes along (without pulling in the course's other classes).
export const toggleClass = (state: CopySelectionState, course: CopyCoursePreviewDto, classItem: CopyClassPreviewDto, checked: boolean): CopySelectionState => {
  if (checked && !getClassAvailability(course, classItem, getTargetMode(course, state)).selectable) return state;
  return {
    ...state,
    courseIds: checked ? withCourse(state, course.id, true) : state.courseIds,
    classIds: withClasses(state, [classItem.id], checked),
  };
};

// "All" pulls in every eligible class (even ones already copied, if the owner wants a second copy in a
// separate course); "None" leaves the course ticked with no classes - the course-only case.
export const setCourseClasses = (state: CopySelectionState, course: CopyCoursePreviewDto, which: 'all' | 'none'): CopySelectionState => {
  if (!course.canCopy) return state;
  if (which === 'none') {
    return { ...state, courseIds: withCourse(state, course.id, true), classIds: withClasses(state, course.classes.map((classItem) => classItem.id), false) };
  }
  const mode = getTargetMode(course, state);
  const eligible = selectableClasses(course, mode).map((classItem) => classItem.id);
  return { ...state, courseIds: withCourse(state, course.id, true), classIds: withClasses(state, eligible, true) };
};

// Switching a course to "merge into the existing one" can make some already-ticked classes ineligible,
// so those are unticked rather than left selected but ignored.
export const setTargetMode = (state: CopySelectionState, course: CopyCoursePreviewDto, mode: CopyTargetMode): CopySelectionState => {
  const stillEligible = new Set(selectableClasses(course, mode).map((classItem) => classItem.id));
  const dropped = course.classes.filter((classItem) => state.classIds.has(classItem.id) && !stillEligible.has(classItem.id)).map((classItem) => classItem.id);
  return { ...state, targetModes: { ...state.targetModes, [course.id]: mode }, classIds: withClasses(state, dropped, false) };
};

const hasNothingLeftToCopy = (course: CopyCoursePreviewDto): boolean =>
  course.destinationMatch?.reason === 'copied' && defaultClassIds(course, 'existing').length === 0;

// Everything that still needs copying: every copyable course, with its eligible uncopied classes.
// A course already fully copied is left alone rather than ticked as a no-op.
export const selectEverything = (preview: OfferingCopyPreviewDto, state: CopySelectionState): CopySelectionState => {
  let next = state;
  for (const course of preview.courses) {
    if (!course.canCopy || hasNothingLeftToCopy(course)) continue;
    next = toggleCourse(next, course, true);
  }
  return next;
};

// Just the courses that don't exist in the destination yet, with none of their classes.
export const selectCoursesOnly = (preview: OfferingCopyPreviewDto, state: CopySelectionState): CopySelectionState => {
  let next = state;
  for (const course of preview.courses) {
    if (!course.canCopy || course.destinationMatch) continue;
    next = setCourseClasses(toggleCourse(next, course, true), course, 'none');
  }
  return next;
};

// The request the wizard would send. A merge with no classes ticked would do nothing, so it's left
// out - which also keeps the summary counts honest about what will actually be created.
export const buildCopyEntries = (preview: OfferingCopyPreviewDto, state: CopySelectionState): CopyCourseEntryInput[] =>
  preview.courses.flatMap((course): CopyCourseEntryInput[] => {
    if (!state.courseIds.has(course.id) || !course.canCopy) return [];
    const mode = getTargetMode(course, state);
    const classIds = course.classes
      .filter((classItem) => state.classIds.has(classItem.id) && getClassAvailability(course, classItem, mode).selectable)
      .map((classItem) => classItem.id);

    if (mode === 'existing' && course.destinationMatch) {
      return classIds.length === 0 ? [] : [{ sourceCourseId: course.id, target: { mode: 'existing', courseId: course.destinationMatch.courseId }, classIds }];
    }
    return [{ sourceCourseId: course.id, target: { mode: 'create' }, classIds }];
  });

export interface SelectionSummary {
  readonly newCourses: number;
  readonly mergedCourses: number;
  readonly classes: number;
}

export const summarizeSelection = (entries: readonly CopyCourseEntryInput[]): SelectionSummary => ({
  newCourses: entries.filter((entry) => entry.target.mode === 'create').length,
  mergedCourses: entries.filter((entry) => entry.target.mode === 'existing').length,
  classes: entries.reduce((sum, entry) => sum + entry.classIds.length, 0),
});
