import { z } from 'zod';
import { LEDGER_CHARGE_CATEGORIES, LEDGER_PAYMENT_METHODS, STAFF_LEDGER_PAYMENT_METHODS } from '@inithium/db';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
// Plain calendar date "YYYY-MM-DD", stored as UTC midnight like every other date in the app.
const calendarDate = z
  .string()
  .regex(DATE_REGEX, 'Expected YYYY-MM-DD')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const amountCents = z.number().int().positive('Enter an amount greater than zero');
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Expected an id');
const optionalNote = z.string().trim().max(500).optional();

export const addLedgerChargeSchema = z.object({
  amountCents,
  description: z.string().trim().min(1, 'Enter a description').max(200),
  category: z.enum(LEDGER_CHARGE_CATEGORIES),
  studentId: objectId.optional(),
  dueDate: calendarDate.optional(),
  note: optionalNote,
});

export const recordLedgerPaymentSchema = z
  .object({
    amountCents,
    method: z.enum(STAFF_LEDGER_PAYMENT_METHODS),
    checkNumber: z.string().trim().max(50).optional(),
    receivedAt: calendarDate,
    note: optionalNote,
    chargeIds: z.array(objectId).max(100).optional(),
  })
  .refine((payment) => payment.method !== 'check' || Boolean(payment.checkNumber), {
    path: ['checkNumber'],
    message: 'Enter the check number',
  });

export const voidLedgerEntrySchema = z.object({
  reason: z.string().trim().min(1, 'Enter a reason').max(500),
});

export const ledgerPaymentsExportQuerySchema = z.object({
  from: calendarDate,
  to: calendarDate,
  method: z.enum(LEDGER_PAYMENT_METHODS).optional(),
});
