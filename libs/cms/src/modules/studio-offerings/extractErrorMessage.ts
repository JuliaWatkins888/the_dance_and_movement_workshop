// Semester/Course deletes can be blocked server-side by a cascade-delete guard (ConflictError -
// see courses.route.ts/semesters.route.ts), and unlike every other create/edit form in this
// codebase (which only ever shows a generic "could not save" string on failure), that specific
// message is worth surfacing verbatim - it tells the admin exactly what's still underneath
// ("3 courses and 2 workshops") rather than leaving them to guess why the delete was refused.
export const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data) {
      const message = (data as { error?: { message?: unknown } }).error?.message;
      if (typeof message === 'string') return message;
    }
  }
  return fallback;
};
