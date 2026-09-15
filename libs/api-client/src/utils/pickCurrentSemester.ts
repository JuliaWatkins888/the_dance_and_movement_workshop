// There's no stored "isCurrent" flag on a Semester - the owner plans terms by date range, not by
// flipping a switch, so "the current semester" is derived here instead: the published semester
// whose range contains today, else the soonest upcoming one, else the most recently ended one.
// Shared by the Studio Offerings dashboard (default semester scope) and the public CourseBrowsePage/
// WorkshopsPage (which semester's section to label "now enrolling").
export interface SemesterLike {
  startDate: string;
  endDate: string;
  isPublished: boolean;
}

export const pickCurrentSemester = <T extends SemesterLike>(semesters: readonly T[]): T | undefined => {
  const published = semesters.filter((semester) => semester.isPublished);
  if (published.length === 0) return undefined;

  const now = Date.now();
  const inProgress = published.find((semester) => new Date(semester.startDate).getTime() <= now && now <= new Date(semester.endDate).getTime());
  if (inProgress) return inProgress;

  const upcoming = [...published]
    .filter((semester) => new Date(semester.startDate).getTime() > now)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  if (upcoming[0]) return upcoming[0];

  const past = [...published].sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
  return past[0];
};
