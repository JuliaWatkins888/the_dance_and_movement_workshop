export type ApiResponseMeta = Record<string, unknown>;
export type ApiErrorDetails = Record<string, unknown>;

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: ApiResponseMeta;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: ApiErrorDetails;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
}

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;
