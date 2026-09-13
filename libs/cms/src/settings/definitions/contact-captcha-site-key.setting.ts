import type { SettingDefinition } from './registry';

const contactCaptchaSiteKeySetting: SettingDefinition = {
  key: 'contact.captchaSiteKey',
  label: 'Turnstile Site Key',
  description:
    'Your Cloudflare Turnstile site key - safe to be public, unlike the matching secret key (set as TURNSTILE_SECRET_KEY in the API server’s environment, never here). Get one from the Turnstile section of the Cloudflare dashboard. Only used while "Require CAPTCHA on Contact Form" is on.',
  group: 'Contact',
  order: 11,
  type: 'string',
  default: '',
};

export default contactCaptchaSiteKeySetting;
