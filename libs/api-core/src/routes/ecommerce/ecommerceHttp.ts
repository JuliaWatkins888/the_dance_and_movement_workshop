import type { Request } from 'express';
import type { z } from 'zod';
import { UnauthorizedError, ValidationError, createSuccessResponse } from '@inithium/api-utils';
import type { PaginatedResult } from '@inithium/db';

export const normalizeParam = (raw: string | string[] | undefined): string => (Array.isArray(raw) ? raw[0] : raw ?? '');

export const parseBody = <T extends z.ZodType>(schema: T, body: unknown): z.infer<T> => {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw ValidationError('Invalid request body', parsed.error.flatten());
  }
  return parsed.data;
};

export const parsePaging = (req: Request, defaultPageSize = 20): { page: number; pageSize: number } => ({
  page: Math.max(1, Number(req.query['page']) || 1),
  pageSize: Math.min(100, Math.max(1, Number(req.query['pageSize']) || defaultPageSize)),
});

export const queryString = (req: Request, key: string): string | undefined => {
  const value = req.query[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

export const paginatedResponse = <T, R>(result: PaginatedResult<T>, items: R[]) =>
  createSuccessResponse(items, {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
  });

// requireAuth always runs first on these routes; this only narrows the type.
export const currentUserId = (req: Request): string => {
  if (!req.user) throw UnauthorizedError();
  return req.user.sub;
};
