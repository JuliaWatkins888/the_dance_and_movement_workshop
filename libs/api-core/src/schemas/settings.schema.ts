import { z } from 'zod';

const SETTING_TYPES = ['string', 'boolean', 'number', 'date', 'stringList', 'json', 'color', 'image'] as const;

// Same 3/6-digit hex shape ColorPicker validates client-side (libs/ui/src/contracts/color.contract.ts's
// HEX_COLOR_PATTERN) - duplicated here rather than imported since libs/api-core has no dependency on
// libs/ui, and this is the server-side backstop regardless of what the CMS form already checked.
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Zod schema each `type` must match, keyed the same way settingValueSchemas is switched on in
// the route handler - z.unknown() at the top level, then superRefine cross-checks `value`
// against whichever of these `type` selects, so an admin can never save e.g. a string into a
// setting declared boolean.
const settingValueSchemas: Record<(typeof SETTING_TYPES)[number], z.ZodTypeAny> = {
  string: z.string(),
  boolean: z.boolean(),
  number: z.number(),
  date: z.string(),
  stringList: z.array(z.string()),
  json: z.record(z.string(), z.unknown()),
  color: z.string().regex(HEX_COLOR_PATTERN),
  // Empty url resets to the consumer's bundled default. A non-empty url without an assetId is
  // rejected - image settings only accept R2 uploads, and the route derives url from the asset.
  image: z
    .object({ url: z.string(), assetId: z.string().min(1).optional() })
    .strict()
    .refine((value) => value.url === '' || Boolean(value.assetId)),
};

export const upsertSettingSchema = z
  .object({
    type: z.enum(SETTING_TYPES),
    value: z.unknown(),
  })
  .superRefine((data, ctx) => {
    const valueSchema = settingValueSchemas[data.type];
    const result = valueSchema.safeParse(data.value);
    if (!result.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: `value does not match declared type "${data.type}"`,
      });
    }
  });

export type UpsertSettingRequestBody = z.infer<typeof upsertSettingSchema>;

const STUDIO_HOURS_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const STUDIO_HOURS_TEXT_MAX_LENGTH = 60;
const URL_MAX_LENGTH = 2000;
const MIN_PHONE_DIGITS = 7;

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

// Browsers strip tabs/newlines from an href and read backslashes as slashes, so "/\t/evil.com" and
// "/\evil.com" would both land on another site despite starting with a single slash.
const isSameSitePath = (value: string): boolean =>
  value.startsWith('/') && !value.startsWith('//') && !/[\t\r\n\\]/.test(value);

const requiredTextSchema = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(maxLength, `${label} must be ${maxLength} characters or fewer.`);

const socialUrlSchema = (label: string) =>
  z
    .string()
    .trim()
    .max(URL_MAX_LENGTH)
    .refine((value) => value === '' || isHttpsUrl(value), `${label} must be blank or a full https:// link.`);

const studioHoursSchema = z
  .object({
    days: z
      .array(
        z
          .object({
            day: z.enum(STUDIO_HOURS_DAYS),
            text: requiredTextSchema('Hours text', STUDIO_HOURS_TEXT_MAX_LENGTH),
            linkUrl: z
              .string()
              .trim()
              .max(URL_MAX_LENGTH)
              .refine(
                (value) => isSameSitePath(value) || isHttpsUrl(value),
                'Hours links must start with / or https://.',
              )
              .optional(),
          })
          .strict(),
      )
      .length(STUDIO_HOURS_DAYS.length, 'Hours must have exactly one entry per day.'),
  })
  .strict()
  .refine(
    ({ days }) => days.every((entry, index) => entry.day === STUDIO_HOURS_DAYS[index]),
    'Hours must list Mon through Sun in order.',
  );

const stringSetting = <Value extends z.ZodTypeAny>(value: Value) => z.object({ type: z.literal('string'), value });

// The stricter rules some settings need beyond their declared type. A Map rather than an object so
// a :key of "__proto__" or "constructor" can't resolve to an inherited property.
const keyedSettingSchemas = new Map<string, z.ZodType<{ type: (typeof SETTING_TYPES)[number]; value: unknown }>>([
  ['studio.name', stringSetting(requiredTextSchema('Studio name', 120))],
  ['studio.address', stringSetting(requiredTextSchema('Address', 200))],
  [
    'studio.phone',
    stringSetting(
      requiredTextSchema('Phone', 40).refine(
        (value) => value.replace(/\D/g, '').length >= MIN_PHONE_DIGITS,
        'Enter a phone number with its area code.',
      ),
    ),
  ],
  ['studio.email', stringSetting(z.string().trim().pipe(z.email('Enter a valid email address.')))],
  ['studio.facebookUrl', stringSetting(socialUrlSchema('Facebook link'))],
  ['studio.instagramUrl', stringSetting(socialUrlSchema('Instagram link'))],
  ['studio.hours', z.object({ type: z.literal('json'), value: studioHoursSchema })],
]);

export const upsertSettingSchemaFor = (key: string) => keyedSettingSchemas.get(key) ?? upsertSettingSchema;
