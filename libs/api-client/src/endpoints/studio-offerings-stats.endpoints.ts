import type { ApiResponse } from '@inithium/api-utils';
import { baseApi } from '../baseApi';

// The Studio Offerings CMS dashboard's "1000-foot view" - pure rollup counts, no schedule/
// registration data (see studio-offerings.route.ts's own comment on why this is one small
// aggregate endpoint rather than deriving counts from full list fetches client-side).
export interface StudioOfferingsStatsDto {
  semesterCount: number;
  courseCount: number;
  classCount: number;
  workshopCount: number;
}

export const studioOfferingsStatsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStudioOfferingsStats: builder.query<StudioOfferingsStatsDto, { semesterId?: string }>({
      query: ({ semesterId }) => {
        const query = semesterId ? `?${new URLSearchParams({ semesterId })}` : '';
        return `/api/studio-offerings/stats${query}`;
      },
      transformResponse: (response: ApiResponse<StudioOfferingsStatsDto>) => response.data,
      providesTags: ['Semester', 'Course', 'Class', 'Workshop'],
    }),
  }),
});

export const { useGetStudioOfferingsStatsQuery } = studioOfferingsStatsApi;
