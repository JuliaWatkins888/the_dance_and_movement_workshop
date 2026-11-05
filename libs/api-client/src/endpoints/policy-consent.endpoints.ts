import type { ApiResponse } from '@inithium/api-utils';
import { baseApi } from '../baseApi';

export const POLICY_CONSENT_REQUIRED = 'POLICY_CONSENT_REQUIRED';
export const POLICY_VERSION_CHANGED = 'POLICY_VERSION_CHANGED';

export type PolicyConsentMethod = 'online' | 'paper';

export interface PolicySnapshotCategoryDto {
  title: string;
  items: { title: string; content: string }[];
}

export interface PolicyConsentStatusDto {
  required: boolean;
  schoolYearId: string | null;
  schoolYearName?: string;
  outstandingSchoolYears: { id: string | null; name?: string }[];
  versionHash: string;
  policies: PolicySnapshotCategoryDto[];
}

export interface PolicyConsentDto {
  id: string;
  userId: string;
  schoolYearId: string | null;
  schoolYearName?: string;
  policyVersionHash: string;
  policySnapshot: PolicySnapshotCategoryDto[];
  signedName: string;
  agreedAt: string;
  method: PolicyConsentMethod;
  ipAddress?: string;
  userAgent?: string;
  recordedByUserId?: string;
  recordedByName?: string;
  orderId?: string;
  createdAt: string;
}

export interface PolicyConsentSummaryDto {
  id: string;
  schoolYearId: string | null;
  schoolYearName?: string;
  agreedAt: string;
  method: PolicyConsentMethod;
  isCurrentVersion: boolean;
}

export interface SignPolicyConsentInput {
  versionHash: string;
  signedName: string;
  agreed: true;
}

export interface RecordPaperPolicyConsentInput {
  userId: string;
  schoolYearId: string;
  signedName: string;
}

export const policyConsentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Depends on the cart's registrations and the published policy text, so it follows both tags.
    getPolicyConsentStatus: builder.query<PolicyConsentStatusDto, void>({
      query: () => '/api/policy-consent/status',
      transformResponse: (response: ApiResponse<PolicyConsentStatusDto>) => response.data,
      providesTags: ['PolicyConsent', 'PolicyCategory', 'Cart'],
    }),
    listMyPolicyConsents: builder.query<PolicyConsentSummaryDto[], void>({
      query: () => '/api/policy-consent/mine',
      transformResponse: (response: ApiResponse<PolicyConsentSummaryDto[]>) => response.data,
      providesTags: ['PolicyConsent', 'PolicyCategory'],
    }),
    signPolicyConsent: builder.mutation<PolicyConsentDto[], SignPolicyConsentInput>({
      query: (body) => ({ url: '/api/policy-consent', method: 'POST', body }),
      transformResponse: (response: ApiResponse<PolicyConsentDto[]>) => response.data,
      invalidatesTags: ['PolicyConsent'],
    }),
    listUserPolicyConsents: builder.query<PolicyConsentDto[], string>({
      query: (userId) => `/api/users/${userId}/policy-consents`,
      transformResponse: (response: ApiResponse<PolicyConsentDto[]>) => response.data,
      providesTags: ['PolicyConsent'],
    }),
    recordPaperPolicyConsent: builder.mutation<PolicyConsentDto, RecordPaperPolicyConsentInput>({
      query: ({ userId, ...body }) => ({ url: `/api/users/${userId}/policy-consents/paper`, method: 'POST', body }),
      transformResponse: (response: ApiResponse<PolicyConsentDto>) => response.data,
      invalidatesTags: ['PolicyConsent'],
    }),
  }),
});

export const {
  useGetPolicyConsentStatusQuery,
  useListMyPolicyConsentsQuery,
  useSignPolicyConsentMutation,
  useListUserPolicyConsentsQuery,
  useRecordPaperPolicyConsentMutation,
} = policyConsentApi;
