export type StorageOperation = 'upload' | 'delete' | 'sign' | 'configure';

// Carries the provider's own diagnosis (S3/R2 error name + HTTP status) so the host can log it
// verbatim while showing end users a generic message. Never includes credentials.
export interface StorageFailure extends Error {
  readonly name: 'StorageError';
  readonly operation: StorageOperation;
  readonly providerCode: string;
  readonly httpStatus?: number;
  readonly cause: unknown;
}

export const isStorageFailure = (error: unknown): error is StorageFailure =>
  error instanceof Error && error.name === 'StorageError' && 'providerCode' in error;
