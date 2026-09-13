import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler, createSuccessResponse, ForbiddenError, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission, hasCapability } from '@inithium/permissions';
import {
  addCommunicationMessage,
  createCommunication,
  deleteCommunication,
  deleteNotificationsByActionUrls,
  getCommunicationById,
  getSetting,
  getUserRepository,
  listCommunications,
  listCommunicationsForUser,
} from '@inithium/db';
import type { CommunicationSearchField } from '@inithium/db';
import { createNotification } from '@inithium/notifications';
import { addCommunicationMessageSchema, createCommunicationSchema } from '../schemas/contact.schema';

const router: RouterType = Router();

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const SEARCH_FIELDS = ['subject', 'email', 'firstName', 'lastName'] as const;
const isSearchField = (value: unknown): value is CommunicationSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

// Always-on spam defense #2 (honeypot is #1, in the schema/route below; CAPTCHA is optional, #3).
// requireAuth already means a spammer needs a real account, but that account can still be
// scripted, so this caps how much damage one session/IP can do regardless.
const contactRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many contact requests from this address. Please try again later.' },
  },
});

// Optional spam defense #3 - only invoked when the contact.captchaEnabled setting is on. Fails
// closed (returns false, never throws) whenever TURNSTILE_SECRET_KEY isn't configured, matching
// that setting's own description warning that this will break submissions rather than silently
// no-op.
const verifyTurnstileToken = async (token: string | undefined, remoteIp: string): Promise<boolean> => {
  const secretKey = process.env['TURNSTILE_SECRET_KEY'];
  if (!secretKey || !token) {
    return false;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: secretKey, response: token, remoteip: remoteIp }),
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
};

const isCaptchaRequired = async (): Promise<boolean> => {
  const setting = await getSetting('contact.captchaEnabled');
  return setting?.type === 'boolean' && setting.value === true;
};

// Shared by every place that creates or later sweeps a notification about a given thread, so the
// DELETE route's cleanup can never drift from whatever URL a notification was actually created
// with.
const recipientActionUrl = (communicationId: string): string => `/cms/communications?threadId=${communicationId}`;
const submitterActionUrl = (communicationId: string): string => `/contact/thread/${communicationId}`;

// The one place a new-submission-or-follow-up notifies the configured admin recipient. Silently
// no-ops (after a console warning) when the setting is unset or doesn't resolve to a real user -
// a misconfigured recipient must never block saving the submitter's message.
const notifyRecipient = async (title: string, body: string, communicationId: string): Promise<void> => {
  const recipientSetting = await getSetting('contact.recipientEmail');
  const recipientEmail = recipientSetting?.type === 'string' ? recipientSetting.value.trim() : '';
  if (!recipientEmail) {
    return;
  }

  const recipient = await getUserRepository().findByEmail(recipientEmail);
  if (!recipient) {
    console.warn(`[contact] contact.recipientEmail "${recipientEmail}" does not match any user - skipping notification`);
    return;
  }

  await createNotification({
    userId: recipient.id,
    type: 'contact:message-received',
    title,
    body,
    actionUrl: recipientActionUrl(communicationId),
    icon: 'Envelope',
  });
};

router.post(
  '/api/contact',
  requireAuth,
  contactRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createCommunicationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    // Honeypot: a real visitor never sees/fills this field (rendered off-screen in ContactPage).
    // Respond as if it worked so a bot never learns it was caught, but persist nothing.
    if (parsed.data.companyWebsite) {
      res.status(201).json(createSuccessResponse(null));
      return;
    }

    if (await isCaptchaRequired()) {
      const verified = await verifyTurnstileToken(parsed.data.turnstileToken, req.ip ?? '');
      if (!verified) {
        throw ValidationError('CAPTCHA verification failed. Please try again.');
      }
    }

    const communication = await createCommunication({
      submitterUserId: req.user!.sub,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      subject: parsed.data.subject,
      message: parsed.data.message,
    });

    await notifyRecipient(`New contact message: "${communication.subject}"`, parsed.data.message, communication.id);

    res.status(201).json(createSuccessResponse(communication));
  }),
);

// Shared by both directions of the thread - which one a given call is depends on the caller's
// relationship to the communication, not on a separate admin-only route, so a reply and a
// follow-up look identical from the client's point of view (see CommunicationThreadDialog).
router.post(
  '/api/contact/:id/messages',
  requireAuth,
  contactRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const parsed = addCommunicationMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const communication = await getCommunicationById(id);
    if (!communication) {
      throw NotFoundError('Communication not found');
    }

    const isSubmitter = communication.submitterUserId === req.user!.sub;
    const actingUser = await getUserRepository().findById(req.user!.sub);
    const isStaff = actingUser ? hasCapability(actingUser, 'contact:manageThreads') : false;
    if (!isSubmitter && !isStaff) {
      throw ForbiddenError('You do not have access to this communication');
    }

    const authorName = actingUser ? `${actingUser.firstName} ${actingUser.lastName ?? ''}`.trim() : 'Someone';

    const updated = await addCommunicationMessage(id, {
      authorRole: isSubmitter ? 'submitter' : 'admin',
      authorUserId: req.user!.sub,
      authorName,
      body: parsed.data.body,
    });
    if (!updated) {
      throw NotFoundError('Communication not found');
    }

    if (isSubmitter) {
      await notifyRecipient(`New message on "${communication.subject}"`, parsed.data.body, communication.id);
    } else {
      await createNotification({
        userId: communication.submitterUserId,
        type: 'contact:replied',
        title: `You have a new reply about "${communication.subject}"`,
        body: parsed.data.body,
        actionUrl: submitterActionUrl(communication.id),
        icon: 'ChatCircle',
      });
    }

    res.status(200).json(createSuccessResponse(updated));
  }),
);

// Registered before "/api/contact/:id" - literal segments ahead of a param route, the same
// ordering gallery.route.ts/blog.route.ts use for their own literal sibling routes.
router.get(
  '/api/contact/mine',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const communications = await listCommunicationsForUser(req.user!.sub);
    res.status(200).json(createSuccessResponse(communications));
  }),
);

router.get(
  '/api/contact',
  requireAuth,
  requirePermission('contact:manageThreads'),
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query['page']) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query['pageSize']) || 20));
    const rawSearch = typeof req.query['search'] === 'string' ? req.query['search'].trim() : undefined;
    const rawSearchField = req.query['searchField'];
    const searchField = isSearchField(rawSearchField) ? rawSearchField : 'subject';

    const result = await listCommunications({
      page,
      pageSize,
      search: rawSearch || undefined,
      searchField: rawSearch ? searchField : undefined,
    });

    res.status(200).json(
      createSuccessResponse(result.items, {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
      }),
    );
  }),
);

router.get(
  '/api/contact/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const communication = await getCommunicationById(id);
    if (!communication) {
      throw NotFoundError('Communication not found');
    }

    const isSubmitter = communication.submitterUserId === req.user!.sub;
    const actingUser = await getUserRepository().findById(req.user!.sub);
    const isStaff = actingUser ? hasCapability(actingUser, 'contact:manageThreads') : false;
    if (!isSubmitter && !isStaff) {
      throw ForbiddenError('You do not have access to this communication');
    }

    res.status(200).json(createSuccessResponse(communication));
  }),
);

// Permanent, admin/editor-only. Sweeps every notification this thread ever generated - both the
// submitter's 'contact:replied' ones and the configured recipient's 'contact:message-received'
// ones - so nobody is left with a notification that 404s once clicked.
router.delete(
  '/api/contact/:id',
  requireAuth,
  requirePermission('contact:manageThreads'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const communication = await getCommunicationById(id);
    if (!communication) {
      throw NotFoundError('Communication not found');
    }

    await deleteCommunication(id);
    await deleteNotificationsByActionUrls([recipientActionUrl(id), submitterActionUrl(id)]);

    res.status(204).send();
  }),
);

export default router;
