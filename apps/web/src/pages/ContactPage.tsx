import { useEffect, useRef, useState } from 'react';
import { alert, Box, Button, Input, Text, Textarea } from '@inithium/ui';
import { useIsContactCaptchaEnabled, useContactCaptchaSiteKey, useSubmitContactMutation } from '@inithium/api-client';
import { useCurrentUser } from '../app/useCurrentUser';

interface TurnstileGlobal {
  render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void }) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileGlobal;
  }
}

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  subject?: string;
  message?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validate = (firstName: string, lastName: string, email: string, subject: string, message: string): FieldErrors => {
  const errors: FieldErrors = {};
  if (!firstName.trim()) errors.firstName = 'First name is required.';
  if (!lastName.trim()) errors.lastName = 'Last name is required.';
  if (!EMAIL_REGEX.test(email)) errors.email = 'Please enter a valid email.';
  if (!subject.trim()) errors.subject = 'Subject is required.';
  if (!message.trim()) errors.message = 'Message is required.';
  return errors;
};

// Loaded once, lazily, only while CAPTCHA is actually turned on - avoids pulling in Cloudflare's
// script for every visitor of a site that never enables contact.captchaEnabled.
const useTurnstileScript = (enabled: boolean): boolean => {
  const [loaded, setLoaded] = useState(() => Boolean(window.turnstile));

  useEffect(() => {
    if (!enabled || loaded) return;

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => setLoaded(true), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => setLoaded(true), { once: true });
    document.head.appendChild(script);
  }, [enabled, loaded]);

  return loaded;
};

export const ContactPage = () => {
  const { currentUser } = useCurrentUser();
  const [submitContact, { isLoading }] = useSubmitContactMutation();
  const captchaEnabled = useIsContactCaptchaEnabled();
  const captchaSiteKey = useContactCaptchaSiteKey();
  const turnstileScriptLoaded = useTurnstileScript(captchaEnabled);

  const [firstName, setFirstName] = useState(currentUser?.firstName ?? '');
  const [lastName, setLastName] = useState(currentUser?.lastName ?? '');
  const [email, setEmail] = useState(currentUser?.email ?? '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  // Honeypot - never rendered visibly, never touched by a real visitor. Its container is
  // off-screen and unreachable by keyboard, so only a bot that blindly fills every form field
  // (visible or not) will ever populate it.
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileTokenRef = useRef('');

  useEffect(() => {
    if (!captchaEnabled || !captchaSiteKey || !turnstileScriptLoaded || !turnstileContainerRef.current) return;

    const turnstile = window.turnstile;
    if (!turnstile) return;

    const widgetId = turnstile.render(turnstileContainerRef.current, {
      sitekey: captchaSiteKey,
      callback: (token) => {
        turnstileTokenRef.current = token;
      },
    });

    return () => turnstile.remove(widgetId);
  }, [captchaEnabled, captchaSiteKey, turnstileScriptLoaded]);

  const handleSubmit = async () => {
    // The page itself is public (so the navbar link never 404s for a logged-out visitor), but
    // submitting requires an account - this is a friendly heads-up before they fill out the
    // whole form only to hit the server's own requireAuth 401, not the real enforcement (that's
    // POST /api/contact's requireAuth middleware, which stays in place regardless of this check).
    if (!currentUser) {
      alert.danger('Please log in before submitting a contact form.', {
        position: 'bottom-right',
        animation: { entrance: 'animate__fadeInUp', exit: 'animate__fadeOutDown' },
      });
      return;
    }

    const validationErrors = validate(firstName, lastName, email, subject, message);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      alert.danger('There were problems submitting your form.', {
        position: 'bottom-right',
        animation: { entrance: 'animate__fadeInUp', exit: 'animate__fadeOutDown' },
      });
      return;
    }

    setFieldErrors({});
    try {
      await submitContact({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
        companyWebsite: companyWebsite || undefined,
        turnstileToken: turnstileTokenRef.current || undefined,
      }).unwrap();
      setSubmitted(true);
    } catch {
      alert.danger('Could not send your message. Please try again.', {
        position: 'bottom-right',
        animation: { entrance: 'animate__fadeInUp', exit: 'animate__fadeOutDown' },
      });
    }
  };

  if (submitted) {
    return (
      <Box
        flex={{ direction: 'col', gap: 16, justify: 'center', align: 'center' }}
        padding={{ base: 32 }}
        className="w-full flex-1"
      >
        <Text as="h1" className="text-3xl font-bold text-surface-950">
          Message sent
        </Text>
        <Text as="p" className="max-w-md text-center text-surface-700">
          Thanks for reaching out - we&apos;ll get back to you soon. You&apos;ll get a notification here as soon as
          we reply.
        </Text>
      </Box>
    );
  }

  return (
    <Box
      flex={{ direction: 'col', gap: 16, justify: 'center', align: 'center' }}
      padding={{ base: 32 }}
      className="w-full flex-1"
    >
      <Text as="h1" className="text-3xl font-bold text-surface-950">
        Contact us
      </Text>

      <Box
        flex={{ direction: 'col', gap: 24, align: 'stretch' }}
        bgColor={{ color: 'surface', intensity: 100 }}
        padding={{ base: 32 }}
        className="w-[95%] rounded md:w-2/3 lg:w-1/3"
      >
        <Input
          label="First name"
          required
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          error={Boolean(fieldErrors.firstName)}
          helperText={fieldErrors.firstName}
        />
        <Input
          label="Last name"
          required
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          error={Boolean(fieldErrors.lastName)}
          helperText={fieldErrors.lastName}
        />
        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={Boolean(fieldErrors.email)}
          helperText={fieldErrors.email}
        />
        <Input
          label="Subject"
          required
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          error={Boolean(fieldErrors.subject)}
          helperText={fieldErrors.subject}
        />
        <Textarea
          label="Message"
          required
          rows={5}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          error={Boolean(fieldErrors.message)}
          helperText={fieldErrors.message}
        />

        {/* Honeypot field: off-screen and unreachable by keyboard/screen reader for a real
            visitor, but present in the DOM for a bot that blindly fills every input. */}
        <div style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }} aria-hidden="true">
          <label htmlFor="companyWebsite">Company website</label>
          <input
            id="companyWebsite"
            name="companyWebsite"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={companyWebsite}
            onChange={(event) => setCompanyWebsite(event.target.value)}
          />
        </div>

        {captchaEnabled && captchaSiteKey ? <div ref={turnstileContainerRef} /> : null}

        <Button onClick={handleSubmit} variant={{ kind: 'filled', color: 'primary' }} disabled={isLoading}>
          {isLoading ? 'Sending…' : 'Send message'}
        </Button>
      </Box>
    </Box>
  );
};

export default ContactPage;
