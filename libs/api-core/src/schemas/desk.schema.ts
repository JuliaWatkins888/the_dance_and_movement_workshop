import { z } from 'zod';
import { STAFF_LEDGER_PAYMENT_METHODS } from '@inithium/db';
import { accountEmailSchema, newPasswordSchema } from './auth.schema';
import { createChildSchema } from './children.schema';
import { manualOrderSchema, postalAddressSchema } from './ecommerce.schema';

// A family account created at the front desk. Email is required so the family can be given a
// login later. Without a password the account gets an unguessable one until staff set a real
// one in CMS → Users.
export const deskAccountSchema = z.object({
  email: accountEmailSchema,
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(7, 'Enter a full phone number').max(30).optional(),
  password: newPasswordSchema.optional(),
});

export const deskStudentSchema = createChildSchema.omit({ parentUserId: true });

export const deskQuoteSchema = manualOrderSchema.extend({
  billingAddress: postalAddressSchema.optional(),
});

const deskPaymentRecordSchema = z
  .object({
    method: z.enum(STAFF_LEDGER_PAYMENT_METHODS),
    amountCents: z.number().int().positive('Enter an amount greater than zero'),
    checkNumber: z.string().trim().max(50).optional(),
  })
  .refine((record) => record.method !== 'check' || Boolean(record.checkNumber), {
    path: ['checkNumber'],
    message: 'Enter the check number',
  });

const deskPaymentSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('card'),
    billingAddress: postalAddressSchema,
    paymentToken: z.string().min(1).max(500).optional(),
    expectedTotalCents: z.number().int().min(0),
  }),
  z.object({
    mode: z.literal('in_person'),
    record: deskPaymentRecordSchema.optional(),
  }),
]);

export const deskOrderSchema = manualOrderSchema.extend({
  payment: deskPaymentSchema,
  consent: z
    .object({
      method: z.enum(['desk', 'paper']),
      signedName: z.string().trim().min(2, 'Enter the name as signed').max(200),
      versionHash: z.string().min(1).max(200),
    })
    .optional(),
});
