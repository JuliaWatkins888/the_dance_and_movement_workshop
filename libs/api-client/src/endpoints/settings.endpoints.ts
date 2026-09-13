import type { ApiResponse } from '@inithium/api-utils';
import { baseApi } from '../baseApi';

// Local mirror of @inithium/db's SETTING_TYPES/SettingEntity - every existing frontend import
// from @inithium/db is `import type` only (see page.endpoints.ts), since @inithium/db's barrel
// also re-exports the Mongo provider and its mongoose-dependent code. SETTING_TYPES is a runtime
// value the UI needs (to drive its type-dispatch), so it's redefined here rather than imported.
export const SETTING_TYPES = ['string', 'boolean', 'number', 'date', 'stringList', 'json', 'color'] as const;
export type SettingType = (typeof SETTING_TYPES)[number];

interface SettingBase {
  id: string;
  key: string;
  updatedAt: string;
}

export type SettingEntity =
  | (SettingBase & { type: 'string'; value: string })
  | (SettingBase & { type: 'boolean'; value: boolean })
  | (SettingBase & { type: 'number'; value: number })
  | (SettingBase & { type: 'date'; value: string })
  | (SettingBase & { type: 'stringList'; value: string[] })
  | (SettingBase & { type: 'json'; value: Record<string, unknown> })
  | (SettingBase & { type: 'color'; value: string });

export type UpsertSettingInput =
  | { key: string; type: 'string'; value: string }
  | { key: string; type: 'boolean'; value: boolean }
  | { key: string; type: 'number'; value: number }
  | { key: string; type: 'date'; value: string }
  | { key: string; type: 'stringList'; value: string[] }
  | { key: string; type: 'json'; value: Record<string, unknown> }
  | { key: string; type: 'color'; value: string };

export const settingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listSettings: builder.query<SettingEntity[], void>({
      query: () => '/api/settings',
      transformResponse: (response: ApiResponse<SettingEntity[]>) => response.data,
      providesTags: ['Settings'],
    }),
    upsertSetting: builder.mutation<SettingEntity, UpsertSettingInput>({
      query: ({ key, ...input }) => ({ url: `/api/settings/${key}`, method: 'PATCH', body: input }),
      transformResponse: (response: ApiResponse<SettingEntity>) => response.data,
      invalidatesTags: ['Settings'],
    }),
    // Unauthenticated read, single key - safe for anonymous public visitors (Navbar, the CMS's
    // own pre-login screen). `query` intentionally has no error handling for a missing key: a
    // 404 is an expected, common case (nothing saved yet, still on the definition's default),
    // not a failure - callers read `data` and fall back themselves, never `error`.
    getPublicSetting: builder.query<SettingEntity, string>({
      query: (key) => `/api/settings/public/${key}`,
      transformResponse: (response: ApiResponse<SettingEntity>) => response.data,
      providesTags: (_result, _error, key) => [{ type: 'Settings', id: key }],
    }),
  }),
});

export const { useListSettingsQuery, useUpsertSettingMutation, useGetPublicSettingQuery } = settingsApi;

const DEFAULT_APP_NAME = 'Inithium';
const APP_NAME_KEY = 'app.name';

// The one shared place every "app.name" consumer (Navbar, Footer, browser tab title,
// CmsLoginPage, CmsShell, HomePage, ...) reads from - a single hook means the
// unset-yet/wrong-type fallback logic exists exactly once, not once per consumer.
export const useAppName = (): string => {
  const { data } = useGetPublicSettingQuery(APP_NAME_KEY);
  return data && data.type === 'string' ? data.value : DEFAULT_APP_NAME;
};

const SHOW_PERSISTENT_NOTIFICATION_CENTER_KEY = 'notifications.showPersistentCenter';

// Same "public setting with a fallback" shape as useAppName - read by both the public Navbar and
// the CMS's own navbar so the bell's always-visible behavior stays in sync across both.
export const useShowPersistentNotificationCenter = (): boolean => {
  const { data } = useGetPublicSettingQuery(SHOW_PERSISTENT_NOTIFICATION_CENTER_KEY);
  return data?.type === 'boolean' ? data.value : false;
};

const PROFILE_ENABLED_KEY = 'profile.enabled';

// Defaults true (on by default, opt out) - this gates a core user-facing page. Must stay in sync
// with profile.route.ts's own isProfileEnabled() fallback and the setting's own `default` in
// libs/cms/src/settings/definitions/profile-enabled.setting.ts.
export const useIsProfileEnabled = (): boolean => {
  const { data } = useGetPublicSettingQuery(PROFILE_ENABLED_KEY);
  return data?.type === 'boolean' ? data.value : true;
};

const DARK_MODE_ENABLED_KEY = 'appearance.darkModeEnabled';

// Defaults false (off unless an admin opts in) - must stay in sync with profile.route.ts's own
// isDarkModeFeatureEnabled() fallback and the setting's own `default` in
// libs/cms/src/settings/definitions/dark-mode-enabled.setting.ts. Acts as a feature kill-switch:
// apps/web's App reads this before ever applying a user's own darkMode preference to the page.
export const useIsDarkModeFeatureEnabled = (): boolean => {
  const { data } = useGetPublicSettingQuery(DARK_MODE_ENABLED_KEY);
  return data?.type === 'boolean' ? data.value : false;
};

// Keys for the CMS's "Appearance" custom brand-color settings - each holds the hex an admin
// wants as that token's 500 intensity (see libs/cms/src/settings/definitions/appearance-*-color.setting.ts).
// A key with no stored setting yet (the common case, before any admin ever touches this screen)
// resolves to `undefined` here, not the definition's default hex - that's deliberate: RootRouter
// only injects a CSS override for tokens that come back defined, so an unset key correctly falls
// through to theme.css's own static default rather than a redundant (and slightly different,
// since it's regenerated) copy of the same color.
const PRIMARY_COLOR_KEY = 'appearance.primaryColor';
const SECONDARY_COLOR_KEY = 'appearance.secondaryColor';
const TERTIARY_COLOR_KEY = 'appearance.tertiaryColor';
const QUATERNARY_COLOR_KEY = 'appearance.quaternaryColor';
const ACCENT_COLOR_KEY = 'appearance.accentColor';
const SURFACE_COLOR_KEY = 'appearance.surfaceColor';

export interface CustomBrandColorSettings {
  readonly primary?: string;
  readonly secondary?: string;
  readonly tertiary?: string;
  readonly quaternary?: string;
  readonly accent?: string;
  readonly surface?: string;
}

const readColorValue = (data: SettingEntity | undefined): string | undefined =>
  data?.type === 'color' ? data.value : undefined;

// One shared place every consumer of the admin's custom brand palette reads from - currently just
// RootRouter (the single place mounted on every route, see its own comment on why), the same
// "one hook, one merge point" pattern as useAppName/useIsDarkModeFeatureEnabled above.
export const useCustomBrandColors = (): CustomBrandColorSettings => {
  const primary = useGetPublicSettingQuery(PRIMARY_COLOR_KEY);
  const secondary = useGetPublicSettingQuery(SECONDARY_COLOR_KEY);
  const tertiary = useGetPublicSettingQuery(TERTIARY_COLOR_KEY);
  const quaternary = useGetPublicSettingQuery(QUATERNARY_COLOR_KEY);
  const accent = useGetPublicSettingQuery(ACCENT_COLOR_KEY);
  const surface = useGetPublicSettingQuery(SURFACE_COLOR_KEY);

  return {
    primary: readColorValue(primary.data),
    secondary: readColorValue(secondary.data),
    tertiary: readColorValue(tertiary.data),
    quaternary: readColorValue(quaternary.data),
    accent: readColorValue(accent.data),
    surface: readColorValue(surface.data),
  };
};

// inithium:block:contact:exports:start
const CONTACT_CAPTCHA_ENABLED_KEY = 'contact.captchaEnabled';

// Defaults false (off unless an admin opts in) - same fallback direction as
// useIsDarkModeFeatureEnabled, and must stay in sync with contact.route.ts's own
// isCaptchaRequired() check and the setting's own `default` in
// libs/cms/src/settings/definitions/contact-captcha-enabled.setting.ts.
export const useIsContactCaptchaEnabled = (): boolean => {
  const { data } = useGetPublicSettingQuery(CONTACT_CAPTCHA_ENABLED_KEY);
  return data?.type === 'boolean' ? data.value : false;
};

const CONTACT_CAPTCHA_SITE_KEY_KEY = 'contact.captchaSiteKey';

// The Turnstile site key is meant to be public (unlike the matching secret key, which is
// server-only and never stored as a setting - see contact.route.ts) - read the same way as any
// other client-visible config in this app, through the public-settings API rather than a Vite
// env var (this app has no existing VITE_* usage to follow instead).
export const useContactCaptchaSiteKey = (): string => {
  const { data } = useGetPublicSettingQuery(CONTACT_CAPTCHA_SITE_KEY_KEY);
  return data?.type === 'string' ? data.value : '';
};

// inithium:block:contact:exports:end
// inithium:anchor:exports
