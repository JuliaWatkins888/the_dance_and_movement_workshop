// Helpers for optional <input type="number"> fields backed by state strings (min/max age). A field that
// was never set can arrive as null as well as undefined, and String(null) is "null" - which a number
// input can't display (browsers log 'The specified value "null" cannot be parsed'), and which then
// round-trips through Number() as NaN, serializes to JSON null, and is rejected by the API.

export const toNumberInputValue = (value: number | null | undefined): string => (value === null || value === undefined ? '' : String(value));

// A blank or non-numeric entry is "not set" (undefined, so the key is dropped from the request body)
// rather than NaN.
export const parseOptionalNumber = (raw: string): number | undefined => {
  if (!raw.trim()) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};
