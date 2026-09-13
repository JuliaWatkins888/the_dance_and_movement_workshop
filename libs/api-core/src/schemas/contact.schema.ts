import { z } from 'zod';

export const createCommunicationSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.email(),
  subject: z.string().min(1, 'Subject is required').max(200),
  message: z.string().min(1, 'Message is required').max(5000),
  // Honeypot: real users never see or fill this field (rendered off-screen in ContactPage). A
  // naive bot that auto-fills every field trips this and gets a normal-looking 201 with nothing
  // actually persisted - see contact.route.ts.
  companyWebsite: z.string().max(0, 'Leave this field empty').optional(),
  // Only checked/required at the route layer when contact.captchaEnabled is on - conditional on
  // an async settings lookup, which doesn't fit a synchronous schema refinement (contrast
  // gallery.schema.ts's superRefine, which only depends on sibling fields already in the body).
  turnstileToken: z.string().optional(),
});
export type CreateCommunicationRequestBody = z.infer<typeof createCommunicationSchema>;

export const addCommunicationMessageSchema = z.object({
  body: z.string().min(1, 'Message is required').max(5000),
});
export type AddCommunicationMessageRequestBody = z.infer<typeof addCommunicationMessageSchema>;
