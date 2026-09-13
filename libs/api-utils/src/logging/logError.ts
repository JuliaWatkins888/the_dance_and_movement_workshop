import { AppError } from '../errors/app-error';

export const logError = (err: unknown): void => {
  const timestamp = new Date().toISOString();

  if (err instanceof AppError) {
    console.error(`[${timestamp}] ${err.statusCode} ${err.code} - ${err.message}`);
    if (err.statusCode >= 500 && err.stack) {
      console.error(err.stack);
    }
    return;
  }

  const name = err instanceof Error ? err.name : 'UnknownError';
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  console.error(`[${timestamp}] 500 ${name} - ${message}`);
  if (stack) {
    console.error(stack);
  }
};
