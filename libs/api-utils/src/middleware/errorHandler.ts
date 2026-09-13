import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { createErrorResponse } from '../responses/response';
import { logError } from '../logging/logError';

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logError(err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json(createErrorResponse(err.code, err.message, err.details));
    return;
  }

  const isProduction = process.env['NODE_ENV'] === 'production';
  const stack = err instanceof Error ? err.stack : undefined;

  res
    .status(500)
    .json(
      createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        'Internal server error',
        isProduction || !stack ? undefined : { stack }
      )
    );
};
