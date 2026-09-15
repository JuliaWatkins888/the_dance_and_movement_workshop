import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { alert, Box, Button, Icon, Input, Text, Textarea } from '@inithium/ui';
import type { IconName } from '@inithium/ui';
import { useIsContactCaptchaEnabled, useContactCaptchaSiteKey, useSubmitContactMutation } from '@inithium/api-client';
import { useCurrentUser } from '../app/useCurrentUser';

const STUDIO_ADDRESS = '64007 Van Dyke Rd. Ste. 2, Washington, MI 48095';
const STUDIO_PHONE = '(248) 495-4756';
const STUDIO_PHONE_TEL = '+12484954756';
const STUDIO_EMAIL = 'thedanceandmovementworkshop@gmail.com';
const FACEBOOK_URL = 'https://www.facebook.com/thedanceandmovementworkshop?_rdr';
const INSTAGRAM_URL = 'https://www.instagram.com/thedanceandmovementworkshop/';

const STUDIO_HOURS: ReadonlyArray<{ readonly day: string; readonly hours: string }> = [
  { day: 'Mon', hours: '3:00 PM – 8:30 PM' },
  { day: 'Tue', hours: '3:00 PM – 8:30 PM' },
  { day: 'Wed', hours: '3:00 PM – 8:30 PM' },
  { day: 'Thu', hours: '3:00 PM – 8:30 PM' },
  { day: 'Fri', hours: '4:30 PM – 7:00 PM' },
  { day: 'Sat', hours: '11:00 AM – 3:00 PM' },
  { day: 'Sun', hours: 'Closed' },
];

// The classic keyless "output=embed" form of a Google Maps URL renders a pinned-location iframe
// with no API key or billing account required - unlike the official Maps Embed API
// (maps.google.com/maps/embed/v1/...), which does require a key. Good enough for a static studio
// address; swap to the Embed API only if this ever needs richer features (custom styling, POI
// filtering, etc.) that the keyless form doesn't support.
const GOOGLE_MAPS_QUERY = encodeURIComponent(STUDIO_ADDRESS);
const GOOGLE_MAPS_EMBED_SRC = `https://www.google.com/maps?q=${GOOGLE_MAPS_QUERY}&output=embed`;
const GOOGLE_MAPS_LINK = `https://www.google.com/maps/search/?api=1&query=${GOOGLE_MAPS_QUERY}`;

interface ContactInfoRowProps {
  readonly icon: IconName;
  readonly children: ReactNode;
}

const ContactInfoRow = ({ icon, children }: ContactInfoRowProps) => (
  <Box flex={{ direction: 'row', gap: 12, align: 'start' }}>
    <Icon
      name={icon}
      size={16}
      weight="bold"
      textColor={{ color: 'accent', intensity: 500 }}
      bgColor={{ color: 'accent', intensity: 100 }}
      padding={{ base: 8 }}
      className="shrink-0 rounded-full"
    />
    <Box flex={{ direction: 'col', gap: 2 }} className="min-w-0 pt-1">
      {children}
    </Box>
  </Box>
);

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
      flex={{ direction: 'col', gap: 32 }}
      className="w-full flex-1 lg:flex-row"
    >
      {/* Contact form */}
      <Box flex={{ direction: 'col', gap: 16 }} padding={{ base: 32 }} className="w-full lg:flex-[3]">
        <Box flex={{ direction: 'col', gap: 4 }}>
          <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-3xl font-bold">
            Get In Touch
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
            Have a question about classes or events? Send us a message and we will get back to you soon.
          </Text>
        </Box>

        {/* flex-1 lets this panel consume whatever's left of the column's own height (itself
            stretched to the row's full min-height - see the root Box above) once the heading
            block above claims its natural height - same "fill the rest" mechanic as
            ProfilePage's Tabs/TabsContent. */}
        <Box
          flex={{ direction: 'col', gap: 20, align: 'stretch' }}
          bgColor={{ color: 'surface', intensity: 100 }}
          padding={{ base: 24 }}
          className="flex-1"
        >
          <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </Box>
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={Boolean(fieldErrors.email)}
            helperText={fieldErrors.email}
            entryAdornment={<Icon as="span" name="EnvelopeSimple" size={16} />}
          />
          <Input
            label="Subject"
            required
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            error={Boolean(fieldErrors.subject)}
            helperText={fieldErrors.subject}
          />
          {/* Textarea's own className only reaches the <textarea> element itself, not
              FieldShell's wrapping div - a grid wrapper (whose default stretch applies to both
              axes, unlike flex's cross-axis-only stretch) hands that div the wrapper's full
              width and height, and the textarea's own flex-1 (FieldShell's div is itself a
              column flex container) then grows to fill whatever's left under the label. */}
          <Box className="grid min-h-0 flex-1">
            <Textarea
              label="Message"
              required
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              error={Boolean(fieldErrors.message)}
              helperText={fieldErrors.message}
              placeholder="Tell us how we can help..."
              className="min-h-0 flex-1 resize-none"
            />
          </Box>

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

          <Button
            onClick={handleSubmit}
            variant={{ kind: 'filled', color: 'primary' }}
            disabled={isLoading}
            exitAdornment={<Icon as="span" name="PaperPlaneRight" size={16} />}
            className="w-full sm:w-auto sm:self-start"
          >
            {isLoading ? 'Sending…' : 'Send message'}
          </Button>
        </Box>
      </Box>

      {/* Contact information */}
      <Box
        flex={{ direction: 'col', gap: 24, align: 'stretch' }}
        bgColor={{ color: 'surface', intensity: 200 }}
        padding={{ base: 32 }}
        className="w-full lg:flex-[2]"
      >
        <Box flex={{ direction: 'col', gap: 4 }}>
          <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-xl font-bold">
            Contact Information
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
            We would love to hear from you. Reach out through any of the channels below.
          </Text>
        </Box>

        <Box flex={{ direction: 'col', gap: 16 }}>
          <ContactInfoRow icon="MapPin">
            <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
              {STUDIO_ADDRESS}
            </Text>
          </ContactInfoRow>

          <ContactInfoRow icon="Phone">
            <Button
              asChild
              variant={{ kind: 'link', color: 'primary' }}
              className="inline-flex w-fit p-0 text-sm font-medium"
            >
              <a href={`tel:${STUDIO_PHONE_TEL}`}>{STUDIO_PHONE}</a>
            </Button>
          </ContactInfoRow>

          <ContactInfoRow icon="EnvelopeSimple">
            <Button
              asChild
              variant={{ kind: 'link', color: 'primary' }}
              className="inline-flex w-fit p-0 text-sm font-medium"
            >
              <a href={`mailto:${STUDIO_EMAIL}`}>{STUDIO_EMAIL}</a>
            </Button>
          </ContactInfoRow>

          <ContactInfoRow icon="Clock">
            <Box flex={{ direction: 'col', gap: 1 }}>
              {STUDIO_HOURS.map(({ day, hours }) => (
                <Box key={day} flex={{ direction: 'row', gap: 8 }}>
                  <Text
                    as="span"
                    textColor={{ color: 'surface', intensity: 900 }}
                    className="w-8 shrink-0 text-xs font-semibold"
                  >
                    {day}
                  </Text>
                  <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-xs">
                    {hours}
                  </Text>
                </Box>
              ))}
            </Box>
          </ContactInfoRow>
        </Box>

        <Box className="relative overflow-hidden rounded-lg border border-surface-300">
          <iframe
            title="The Dance and Movement Workshop location"
            src={GOOGLE_MAPS_EMBED_SRC}
            className="block h-56 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <Button
            asChild
            variant={{ kind: 'filled', color: 'surface', intensity: 100 }}
            padding={{ top: 6, bottom: 6, left: 10, right: 10 }}
            className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full text-xs font-semibold shadow-md"
          >
            <a href={GOOGLE_MAPS_LINK} target="_blank" rel="noopener noreferrer">
              Open in Maps
              <Icon as="span" name="ArrowSquareOut" size={12} />
            </a>
          </Button>
        </Box>

        <Box flex={{ direction: 'row', gap: 12 }}>
          <Button
            asChild
            variant={{ kind: 'filled', color: 'primary' }}
            padding={{ base: 10 }}
            className="rounded-full"
          >
            <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <Icon as="span" name="FacebookLogo" size={18} weight="fill" />
            </a>
          </Button>
          <Button
            asChild
            variant={{ kind: 'filled', color: 'primary' }}
            padding={{ base: 10 }}
            className="rounded-full"
          >
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <Icon as="span" name="InstagramLogo" size={18} weight="fill" />
            </a>
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default ContactPage;
