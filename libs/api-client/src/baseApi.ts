import { createApi, fetchBaseQuery, retry } from '@reduxjs/toolkit/query/react';
import { getStoredAccessToken } from './tokenStorage';

// apps/web (Vite) may define VITE_API_URL in its own env files; wiring that
// env file into apps/web is out of scope here — this just falls back to the
// local dev API port when it isn't set.
const baseUrl = import.meta.env?.['VITE_API_URL'] ?? 'http://localhost:3000';

const rawBaseQuery = fetchBaseQuery({
  baseUrl,
  prepareHeaders: (headers) => {
    const token = getStoredAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

// The API server only starts listening once its own boot sequence (connectDatabase,
// ensureSeededPages, ensureSeededSettings, ...) finishes - on a cold dev-environment start, the
// web app's very first request(s) can easily lose that race and hit a connection that isn't
// accepting yet. fetchBaseQuery alone has no retry policy, so a request that loses this race
// just sits in an error state until something re-triggers it (a manual page refresh) - this is
// exactly the "works fine, except right after startup" symptom that motivated this wrapper.
// retryCondition (RTK Query's `maxRetries` and `retryCondition` options are mutually exclusive,
// hence the manual `attempt` cap here) limits retries to that actual failure mode - no HTTP
// status at all, i.e. FETCH_ERROR/TIMEOUT_ERROR - so a real 401/404/422 from a server that IS up
// still fails immediately, never silently retried.
const MAX_UNREACHABLE_RETRIES = 3;

const baseQueryWithRetry = retry(rawBaseQuery, {
  retryCondition: (error, _args, { attempt }) =>
    attempt <= MAX_UNREACHABLE_RETRIES && typeof (error as { status?: unknown })?.status !== 'number',
});

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithRetry,
  // One tag type per line (not a single-line array) so a plugin's merge fragment can append its
  // own tag(s) as new lines before the closing bracket, instead of splicing inside one line.
  tagTypes: [
    'Page',
    'User',
    'Presence',
    'Notification',
    'Settings',
    'Profile',
// inithium:block:gallery:tag-types:start
    'GalleryImage',
// inithium:block:gallery:tag-types:end
// inithium:block:contact:tag-types:start
    'Communication',
// inithium:block:contact:tag-types:end
// inithium:block:staff:tag-types:start
    'Staff',
// inithium:block:staff:tag-types:end
// inithium:block:time:tag-types:start
    'TimeEntry',
    'TimeEntryType',
    'TimeSettings',
    'TimeAuditLog',
// inithium:block:time:tag-types:end
// inithium:block:policy:tag-types:start
    'PolicyCategory',
// inithium:block:policy:tag-types:end
// inithium:block:classes:tag-types:start
    'Class',
// inithium:block:classes:tag-types:end
// inithium:block:children:tag-types:start
    'Child',
// inithium:block:children:tag-types:end
// inithium:block:studio-offerings:tag-types:start
    'AcademicYear',
    'Semester',
    'Course',
    'Workshop',
// inithium:block:studio-offerings:tag-types:end
    // inithium:anchor:tag-types
  ],
  endpoints: () => ({}),
});
