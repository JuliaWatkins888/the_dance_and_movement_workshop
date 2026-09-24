// There's no stored "isCurrent" flag on an academic year - the owner plans years by their semesters'
// dates, not by flipping a switch, so "the current year" is derived here instead: the published year
// whose range contains today, else the soonest upcoming one, else the most recently ended one.
// Shared by the Studio Offerings dashboard (default year scope) and the public CourseBrowsePage
// (which year the dropdown starts on).
export interface AcademicYearLike {
  startDate?: string;
  endDate?: string;
  isPublished: boolean;
}

const toTime = (iso: string | undefined): number | undefined => (iso ? new Date(iso).getTime() : undefined);

export const pickCurrentAcademicYear = <T extends AcademicYearLike>(years: readonly T[]): T | undefined => {
  const dated = years.filter((year) => year.isPublished && toTime(year.startDate) !== undefined && toTime(year.endDate) !== undefined);
  if (dated.length === 0) return undefined;

  const now = Date.now();
  const start = (year: T): number => toTime(year.startDate) ?? 0;
  const end = (year: T): number => toTime(year.endDate) ?? 0;

  const inProgress = dated.find((year) => start(year) <= now && now <= end(year));
  if (inProgress) return inProgress;

  const upcoming = dated.filter((year) => start(year) > now).sort((a, b) => start(a) - start(b));
  if (upcoming[0]) return upcoming[0];

  return [...dated].sort((a, b) => end(b) - end(a))[0];
};
