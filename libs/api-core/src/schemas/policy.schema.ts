import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';

// Policy item content is authored via the CMS's Tiptap editor (libs/ui's RichTextEditor) and
// rendered as raw HTML on the public policies page (dangerouslySetInnerHTML) - sanitizing here,
// server-side, on every write is defense in depth against a compromised or lower-trust
// policies:manage account turning into stored XSS against every site visitor. The allowlist
// covers everything StarterKit + the Underline/Link extensions can actually produce.
const sanitizePolicyContent = (html: string): string =>
  sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'a'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
  });

const contentSchema = z
  .string()
  .min(1, 'Content is required')
  .transform((value) => sanitizePolicyContent(value));

const categoryShape = {
  title: z.string().min(1, 'Title is required'),
  icon: z.string().min(1).optional(),
  order: z.number().int().optional(),
};

export const createPolicyCategorySchema = z.object(categoryShape);
export type CreatePolicyCategoryRequestBody = z.infer<typeof createPolicyCategorySchema>;

export const updatePolicyCategorySchema = z.object(categoryShape).partial();
export type UpdatePolicyCategoryRequestBody = z.infer<typeof updatePolicyCategorySchema>;

const itemShape = {
  title: z.string().min(1, 'Title is required'),
  content: contentSchema,
  order: z.number().int().optional(),
};

export const createPolicyItemSchema = z.object(itemShape);
export type CreatePolicyItemRequestBody = z.infer<typeof createPolicyItemSchema>;

export const updatePolicyItemSchema = z.object(itemShape).partial();
export type UpdatePolicyItemRequestBody = z.infer<typeof updatePolicyItemSchema>;
