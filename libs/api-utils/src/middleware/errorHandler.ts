import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { createErrorResponse } from '../responses/response';
import { logError } from '../logging/logError';

// express.json() rejects malformed bodies with a SyntaxError carrying `body`/`status` - a client
// mistake, not a server fault.
const isBodyParseError = (err: unknown): err is { status: number; type?: string } =>
  err instanceof SyntaxError && 'body' in err;

const isPayloadTooLarge = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { type?: unknown }).type === 'entity.too.large';

// Mongoose throws CastError when a malformed id reaches a query (e.g. /api/staff/not-an-id).
const isInvalidIdError = (err: unknown): boolean => err instanceof Error && err.name === 'CastError';

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    logError(err);
    res.status(err.statusCode).json(createErrorResponse(err.code, err.message, err.details));
    return;
  }
  if (isBodyParseError(err)) {
    res.status(400).json(createErrorResponse('INVALID_JSON', 'Malformed JSON request body'));
    return;
  }
  if (isPayloadTooLarge(err)) {
    res.status(413).json(createErrorResponse('PAYLOAD_TOO_LARGE', 'Request body is too large'));
    return;
  }
  if (isInvalidIdError(err)) {
    res.status(400).json(createErrorResponse('INVALID_ID', 'Invalid id'));
    return;
  }

  logError(err);

  // Opt-in rather than opt-out: a host that forgets to set NODE_ENV must not leak stack traces.
  const exposeStack = process.env['NODE_ENV'] === 'development';
  const stack = err instanceof Error ? err.stack : undefined;

  res
    .status(500)
    .json(
      createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        'Internal server error',
        exposeStack && stack ? { stack } : undefined
      )
    );
};
