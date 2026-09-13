import type { SettingDefinition } from './registry';

const contactCaptchaEnabledSetting: SettingDefinition = {
  key: 'contact.captchaEnabled',
  label: 'Require CAPTCHA on Contact Form',
  description:
    'Adds a Cloudflare Turnstile challenge to the contact form, on top of the honeypot field and rate limiting that are always on. Requires the Turnstile site key below and a TURNSTILE_SECRET_KEY environment variable on the API server - if either is missing while this is on, the contact form will fail to submit for everyone.',
  group: 'Contact',
  order: 10,
  type: 'boolean',
  default: false,
};

export default contactCaptchaEnabledSetting;
