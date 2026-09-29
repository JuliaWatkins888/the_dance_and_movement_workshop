import { useMemo } from 'react';
import type { ReactElement } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Box,
  Button,
  IconButton,
  Pill,
  Text,
  alert,
  dialog,
} from '@inithium/ui';
import {
  formatMoney,
  readApiError,
  useDeleteClassSectionMutation,
  useDeleteCourseMutation,
  useDeleteProgramMutation,
  useGetAdminClassCatalogQuery,
  useListSchoolYearsAdminQuery,
  useUpdateCourseMutation,
  useUpdateProgramMutation,
} from '@inithium/api-client';
import type { ClassSectionDto, CourseDto, ProgramDto, SchoolYearDto } from '@inithium/api-client';
import { EmptyState, useStoreCurrency } from '../ecommerce/shared';
import { ALERT_POSITION, DIALOG_WIDTH, formatAgeRange, formatTime12h } from './classAdmin.shared';
import { CourseEditDialog } from './CourseEditDialog';
import { ProgramEditDialog } from './ProgramEditDialog';
import { SectionEditDialog } from './SectionEditDialog';

// The items whose order changes when `list[from]` moves to `to` - so a reorder only writes what
// actually moved, and heals any duplicate/gapped order values along the way.
const reorderChanges = <T extends { id: string; order: number }>(list: T[], from: number, to: number): { id: string; order: number }[] => {
  const moved = [...list];
  const [item] = moved.splice(from, 1);
  if (!item) return [];
  moved.splice(to, 0, item);
  return moved.flatMap((entry, index) => (entry.order === index ? [] : [{ id: entry.id, order: index }]));
};

const sectionSummary = (section: ClassSectionDto, schoolYear: SchoolYearDto | undefined): string => {
  const days = section.daysOfWeek.map((day) => day.slice(0, 3)).join('/');
  const instructors = section.instructors.map((instructor) => instructor.name).join(' & ') || 'No instructor';
  const semesterNames =
    schoolYear?.semesters.filter((semester) => section.semesterIds.includes(semester.id)).map((semester) => semester.name) ?? [];
  const runs = schoolYear && semesterNames.length === schoolYear.semesters.length ? `${schoolYear.name} (full year)` : semesterNames.join(' & ');
  return `${days} ${formatTime12h(section.startTime)}–${formatTime12h(section.endTime)} · ${instructors} · ${runs} · ${section.enrolled}/${section.capacity} enrolled`;
};

const DraftPill = () => <Pill color={{ color: 'surface', intensity: 300 }} className="text-surface-900">Draft</Pill>;

const confirmDelete = (title: string, description: string) =>
  dialog.confirm({
    title,
    description,
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    confirmVariant: { kind: 'filled', color: 'red' },
  });

export const CatalogTab = () => {
  const currency = useStoreCurrency();
  const { data: catalog, isLoading } = useGetAdminClassCatalogQuery();
  const { data: schoolYears = [] } = useListSchoolYearsAdminQuery();
  const [updateProgram] = useUpdateProgramMutation();
  const [updateCourse] = useUpdateCourseMutation();
  const [deleteProgram] = useDeleteProgramMutation();
  const [deleteCourse] = useDeleteCourseMutation();
  const [deleteSection] = useDeleteClassSectionMutation();

  const programs = catalog?.programs ?? [];
  const courses = catalog?.courses ?? [];
  const sections = catalog?.sections ?? [];

  const knownStyles = useMemo(() => [...new Set(courses.flatMap((course) => course.styles))].sort(), [courses]);
  const schoolYearsById = useMemo(() => new Map(schoolYears.map((year) => [year.id, year])), [schoolYears]);
  const coursesOf = (programId: string) => courses.filter((course) => course.programId === programId);
  const sectionsOf = (courseId: string) => sections.filter((section) => section.courseId === courseId);

  const runSafely = async (action: () => Promise<unknown>, fallback: string) => {
    try {
      await action();
    } catch (error) {
      alert.danger(readApiError(error, fallback).message, { position: ALERT_POSITION });
    }
  };

  const openDialog = (title: string, render: (close: () => void) => ReactElement) => {
    const id = dialog.show(() => render(() => dialog.close(id)), { title, width: DIALOG_WIDTH });
  };

  const openProgramDialog = (program?: ProgramDto) =>
    openDialog(program ? `Edit "${program.name}"` : 'New Program', (close) => <ProgramEditDialog program={program} onDone={close} />);

  const openCourseDialog = (options: { course?: CourseDto; programId?: string }) =>
    openDialog(options.course ? `Edit "${options.course.name}"` : 'New Course', (close) => (
      <CourseEditDialog
        programs={programs}
        course={options.course}
        defaultProgramId={options.programId}
        knownStyles={knownStyles}
        onDone={close}
      />
    ));

  const openSectionDialog = (course: CourseDto, section?: ClassSectionDto) =>
    openDialog(section ? `Edit time slot - ${course.name}` : `New time slot - ${course.name}`, (close) => (
      <SectionEditDialog course={course} schoolYears={schoolYears} section={section} onDone={close} />
    ));

  const moveProgram = (from: number, to: number) =>
    runSafely(
      () => Promise.all(reorderChanges(programs, from, to).map((change) => updateProgram(change).unwrap())),
      'Could not reorder programs.',
    );

  const moveCourse = (programCourses: CourseDto[], from: number, to: number) =>
    runSafely(
      () => Promise.all(reorderChanges(programCourses, from, to).map((change) => updateCourse(change).unwrap())),
      'Could not reorder courses.',
    );

  const handleDeleteProgram = async (program: ProgramDto) => {
    if (!(await confirmDelete('Delete this program?', `This removes "${program.name}". It must have no courses.`))) return;
    await runSafely(() => deleteProgram(program.id).unwrap(), 'Could not delete this program.');
  };

  const handleDeleteCourse = async (course: CourseDto) => {
    if (!(await confirmDelete('Delete this course?', `This removes "${course.name}". It must have no time slots.`))) return;
    await runSafely(() => deleteCourse(course.id).unwrap(), 'Could not delete this course.');
  };

  const handleDeleteSection = async (course: CourseDto, section: ClassSectionDto) => {
    if (!(await confirmDelete('Delete this time slot?', `${course.name}: ${sectionSummary(section, schoolYearsById.get(section.schoolYearId))}`))) return;
    await runSafely(() => deleteSection(section.id).unwrap(), 'Could not delete this time slot.');
  };

  if (isLoading) return <EmptyState message="Loading classes..." />;

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }} className="flex-wrap">
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="max-w-2xl text-sm">
          Programs group courses on the Classes page. A course holds the description and monthly price; each of its time slots
          is a day, time, and instructor families can register for.
        </Text>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => openProgramDialog()}>
          Add Program
        </Button>
      </Box>

      {programs.length === 0 ? <EmptyState message="No programs yet. Add one to start building the catalog." /> : null}

      {programs.map((program, programIndex) => {
        const programCourses = coursesOf(program.id);
        const ageRange = formatAgeRange(program.minAgeYears, program.maxAgeYears);

        return (
          <Box
            key={program.id}
            flex={{ direction: 'col', gap: 12 }}
            borderColor={{ color: 'surface', intensity: 300 }}
            className="rounded-lg border p-4"
          >
            <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }} className="flex-wrap">
              <Box flex={{ direction: 'row', align: 'center', gap: 8 }} className="flex-wrap">
                <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-bold">
                  {program.name}
                </Text>
                {ageRange ? (
                  <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                    {ageRange}
                  </Text>
                ) : null}
                {!program.isPublished ? <DraftPill /> : null}
              </Box>
              <Box flex={{ direction: 'row', align: 'center', gap: 4 }}>
                <IconButton icon="ArrowUp" label={`Move ${program.name} up`} disabled={programIndex === 0} onClick={() => moveProgram(programIndex, programIndex - 1)} />
                <IconButton
                  icon="ArrowDown"
                  label={`Move ${program.name} down`}
                  disabled={programIndex === programs.length - 1}
                  onClick={() => moveProgram(programIndex, programIndex + 1)}
                />
                <IconButton icon="PencilSimple" label={`Edit ${program.name}`} onClick={() => openProgramDialog(program)} />
                <IconButton icon="Trash" label={`Delete ${program.name}`} textColor={{ color: 'red', intensity: 600 }} onClick={() => handleDeleteProgram(program)} />
                <Button variant={{ kind: 'outlined', color: 'primary' }} onClick={() => openCourseDialog({ programId: program.id })}>
                  Add Course
                </Button>
              </Box>
            </Box>

            {programCourses.length === 0 ? (
              <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                No courses in this program yet.
              </Text>
            ) : (
              <Accordion type="multiple">
                {programCourses.map((course, courseIndex) => {
                  const courseSections = sectionsOf(course.id);
                  return (
                    <AccordionItem key={course.id} value={course.id}>
                      <AccordionTrigger>
                        <span className="flex flex-1 flex-wrap items-center gap-2 text-left">
                          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
                            {course.name}
                          </Text>
                          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                            {formatMoney(course.monthlyPriceCents, currency)}/mo · {courseSections.length} time slot
                            {courseSections.length === 1 ? '' : 's'}
                          </Text>
                          {!course.isPublished ? <DraftPill /> : null}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Box flex={{ direction: 'col', gap: 8 }} padding={{ bottom: 8 }}>
                          <Box flex={{ direction: 'row', align: 'center', gap: 4 }} className="flex-wrap">
                            <Button variant={{ kind: 'outlined', color: 'primary' }} onClick={() => openSectionDialog(course)}>
                              Add Time Slot
                            </Button>
                            <Button variant={{ kind: 'ghost', color: 'primary' }} onClick={() => openCourseDialog({ course })}>
                              Edit Course
                            </Button>
                            <IconButton
                              icon="ArrowUp"
                              label={`Move ${course.name} up`}
                              disabled={courseIndex === 0}
                              onClick={() => moveCourse(programCourses, courseIndex, courseIndex - 1)}
                            />
                            <IconButton
                              icon="ArrowDown"
                              label={`Move ${course.name} down`}
                              disabled={courseIndex === programCourses.length - 1}
                              onClick={() => moveCourse(programCourses, courseIndex, courseIndex + 1)}
                            />
                            <IconButton icon="Trash" label={`Delete ${course.name}`} textColor={{ color: 'red', intensity: 600 }} onClick={() => handleDeleteCourse(course)} />
                          </Box>

                          {courseSections.length === 0 ? (
                            <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                              No time slots yet - this course won’t appear on the Classes page until it has one.
                            </Text>
                          ) : (
                            <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
                              {courseSections.map((section) => (
                                <Box
                                  key={section.id}
                                  flex={{ direction: 'row', justify: 'between', align: 'center', gap: 8 }}
                                  borderColor={{ color: 'surface', intensity: 200 }}
                                  padding={{ left: 12, right: 8, top: 6, bottom: 6 }}
                                  className="border-b last:border-b-0"
                                >
                                  <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
                                    {sectionSummary(section, schoolYearsById.get(section.schoolYearId))}
                                  </Text>
                                  <Box flex={{ direction: 'row', align: 'center', gap: 4 }} className="shrink-0">
                                    {!section.isPublished ? <DraftPill /> : null}
                                    <IconButton icon="PencilSimple" label="Edit time slot" onClick={() => openSectionDialog(course, section)} />
                                    <IconButton
                                      icon="Trash"
                                      label="Delete time slot"
                                      textColor={{ color: 'red', intensity: 600 }}
                                      onClick={() => handleDeleteSection(course, section)}
                                    />
                                  </Box>
                                </Box>
                              ))}
                            </Box>
                          )}
                        </Box>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
