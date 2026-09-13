import { ApiErrorDetails } from '../contracts/api-response.contract';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: ApiErrorDetails;

  constructor(statusCode: number, code: string, message: string, details?: ApiErrorDetails) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const NotFoundError = (message = 'Resource not found', details?: ApiErrorDetails): AppError =>
  new AppError(404, 'NOT_FOUND', message, details);

export const UnauthorizedError = (message = 'Unauthorized', details?: ApiErrorDetails): AppError =>
  new AppError(401, 'UNAUTHORIZED', message, details);

export const ForbiddenError = (message = 'Forbidden', details?: ApiErrorDetails): AppError =>
  new AppError(403, 'FORBIDDEN', message, details);

export const ValidationError = (message = 'Validation failed', details?: ApiErrorDetails): AppError =>
  new AppError(400, 'VALIDATION_ERROR', message, details);

export const ConflictError = (message = 'Conflict', details?: ApiErrorDetails): AppError =>
  new AppError(409, 'CONFLICT', message, details);

export const InternalServerError = (message = 'Internal server error', details?: ApiErrorDetails): AppError =>
  new AppError(500, 'INTERNAL_SERVER_ERROR', message, details);
