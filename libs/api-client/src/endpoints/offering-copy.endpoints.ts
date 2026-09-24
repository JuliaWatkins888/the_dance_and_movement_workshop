import type { ApiResponse } from '@inithium/api-utils';
import type { DayOfWeek } from '@inithium/db';
import { baseApi } from '../baseApi';
import type { SemesterSummaryDto } from './academic-years.endpoints';

// The year-to-year copy wizard's two calls (see offering-copy.route.ts): a preview of what the
// source year holds and what's already been copied into the destination, then one request that
// creates the chosen copies as drafts.

export interface CopyClassPreviewDto {
  id: string;
  variantLabel?: string;
  daysOfWeek: DayOfWeek[];
  startTime: string;
  endTime: string;
  minAgeYears?: number;
  maxAgeYears?: number;
  priceAmount: number;
  capacity: number;
  isPublished: boolean;
  // The semesters this class runs in *in the source year* - the copy maps them onto the destination
  // year's matching semesters by term.
  semesters: SemesterSummaryDto[];
  spansFullYear: boolean;
  instructors: { id: string; name: string }[];
  // A copy of this class already exists in the destination match course.
  alreadyCopied: boolean;
}

// An existing destination course the source course could be merged into: 'copied' means it was
// itself copied from this course, 'same-name' means it merely shares the name.
export interface CopyDestinationMatchDto {
  courseId: string;
  name: string;
  reason: 'copied' | 'same-name';
  isPublished: boolean;
  semesters: SemesterSummaryDto[];
  spansFullYear: boolean;
}

export interface CopyCoursePreviewDto {
  id: string;
  name: string;
  description?: string;
  categories: string[];
  imageUrl?: string;
  isPublished: boolean;
  semesters: SemesterSummaryDto[];
  spansFullYear: boolean;
  canCopy: boolean;
  cannotCopyReason?: string;
  destinationMatch: CopyDestinationMatchDto | null;
  classes: CopyClassPreviewDto[];
}

export interface OfferingCopyPreviewDto {
  sourceAcademicYear: { id: string; title: string };
  destinationAcademicYear: { id: string; title: string; semesters: SemesterSummaryDto[] };
  courses: CopyCoursePreviewDto[];
}

export interface OfferingCopyPreviewParams {
  sourceAcademicYearId: string;
  destinationAcademicYearId: string;
}

export type CopyTargetInput = { mode: 'create' } | { mode: 'existing'; courseId: string };

export interface CopyCourseEntryInput {
  sourceCourseId: string;
  target: CopyTargetInput;
  // Empty means course only.
  classIds: string[];
}

export interface OfferingCopyRequest {
  sourceAcademicYearId: string;
  destinationAcademicYearId: string;
  courses: CopyCourseEntryInput[];
}

export interface CopyClassSkipDto {
  classId: string;
  label: string;
  reason: string;
}

export interface CopyCourseResultDto {
  sourceCourseId: string;
  courseName: string;
  outcome: 'created' | 'merged' | 'failed';
  courseId?: string;
  classesCreated: number;
  classesSkipped: CopyClassSkipDto[];
  warnings: string[];
  error?: string;
}

export interface OfferingCopyResultDto {
  results: CopyCourseResultDto[];
  totals: {
    coursesCreated: number;
    coursesMerged: number;
    coursesFailed: number;
    classesCreated: number;
    classesSkipped: number;
  };
}

export const offeringCopyApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Tagged with Course/Class so a finished copy (or any edit in the CMS) refreshes the "already
    // copied" markers.
    getOfferingCopyPreview: builder.query<OfferingCopyPreviewDto, OfferingCopyPreviewParams>({
      query: ({ sourceAcademicYearId, destinationAcademicYearId }) =>
        `/api/studio-offerings/copy-preview?${new URLSearchParams({ sourceAcademicYearId, destinationAcademicYearId }).toString()}`,
      transformResponse: (response: ApiResponse<OfferingCopyPreviewDto>) => response.data,
      providesTags: ['AcademicYear', 'Course', 'Class'],
    }),
    copyOfferings: builder.mutation<OfferingCopyResultDto, OfferingCopyRequest>({
      query: (input) => ({ url: '/api/studio-offerings/copy', method: 'POST', body: input }),
      transformResponse: (response: ApiResponse<OfferingCopyResultDto>) => response.data,
      invalidatesTags: ['Course', 'Class'],
    }),
  }),
});

export const { useGetOfferingCopyPreviewQuery, useCopyOfferingsMutation } = offeringCopyApi;
