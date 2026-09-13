import {
  ApiErrorDetails,
  ApiErrorResponse,
  ApiResponse,
  ApiResponseMeta,
} from '../contracts/api-response.contract';

export const createSuccessResponse = <T>(data: T, meta?: ApiResponseMeta): ApiResponse<T> => ({
  success: true,
  data,
  ...(meta ? { meta } : {}),
});

export const createErrorResponse = (
  code: string,
  message: string,
  details?: ApiErrorDetails
): ApiErrorResponse => ({
  success: false,
  error: {
    code,
    message,
    ...(details ? { details } : {}),
  },
});
