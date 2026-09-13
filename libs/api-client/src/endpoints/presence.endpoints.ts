import type { ApiResponse } from '@inithium/api-utils';
import type { PresenceRecord } from '@inithium/realtime';
import { baseApi } from '../baseApi';

// Snapshot fetch for GET /api/users/:id/presence - see usePresence.ts for why this is only ever
// the *initial* value, with every update after that arriving over the WS channel instead.
export const presenceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUserPresence: builder.query<PresenceRecord, string>({
      query: (userId) => `/api/users/${userId}/presence`,
      transformResponse: (response: ApiResponse<PresenceRecord>) => response.data,
      providesTags: (_result, _error, userId) => [{ type: 'Presence', id: userId }],
    }),
  }),
});

export const { useGetUserPresenceQuery } = presenceApi;
