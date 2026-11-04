import { ZodError } from 'zod';
import type { StorageFailure, StorageOperation } from '../contracts/storage-error.contract';

interface ProviderErrorShape {
  readonly name?: unknown;
  readonly Code?: unknown;
  readonly message?: unknown;
  readonly $metadata?: { readonly httpStatusCode?: unknown };
}

// AWS SDK v3 service exceptions expose the S3 error code as `name` (AccessDenied, NoSuchBucket,
// SignatureDoesNotMatch, InvalidArgument...) and the HTTP status under `$metadata`. A ZodError
// here means the STORAGE_* env didn't parse, which is the most common misconfigured-deploy case.
export const formatConfigIssues = (error: ZodError): readonly string[] =>
  error.issues.map((issue) => {
    const name = issue.path.join('.');
    return issue.code === 'invalid_type' ? `${name} is not set` : `${name}: ${issue.message}`;
  });

const readProviderCode = (cause: unknown): { providerCode: string; httpStatus?: number; detail: string } => {
  if (cause instanceof ZodError) {
    return { providerCode: 'InvalidStorageConfig', detail: formatConfigIssues(cause).join('; ') };
  }
  const shape = (typeof cause === 'object' && cause !== null ? cause : {}) as ProviderErrorShape;
  const code = typeof shape.Code === 'string' ? shape.Code : typeof shape.name === 'string' ? shape.name : 'UnknownError';
  const status = shape.$metadata?.httpStatusCode;
  const detail = typeof shape.message === 'string' ? shape.message : String(cause);
  return { providerCode: code, ...(typeof status === 'number' ? { httpStatus: status } : {}), detail };
};

export const toStorageFailure = (operation: StorageOperation, cause: unknown): StorageFailure => {
  const { providerCode, httpStatus, detail } = readProviderCode(cause);
  const status = httpStatus !== undefined ? ` (HTTP ${httpStatus})` : '';
  const error = new Error(`Storage ${operation} failed: ${providerCode}${status} - ${detail}`);
  return Object.assign(error, {
    name: 'StorageError' as const,
    operation,
    providerCode,
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    cause,
  });
};

export const withStorageFailure =
  <Args extends readonly unknown[], Result>(operation: StorageOperation, run: (...args: Args) => Promise<Result>) =>
  async (...args: Args): Promise<Result> => {
    try {
      return await run(...args);
    } catch (cause) {
      throw toStorageFailure(operation, cause);
    }
  };
