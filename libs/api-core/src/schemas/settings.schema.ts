import { z } from 'zod';

const SETTING_TYPES = ['string', 'boolean', 'number', 'date', 'stringList', 'json', 'color'] as const;

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
