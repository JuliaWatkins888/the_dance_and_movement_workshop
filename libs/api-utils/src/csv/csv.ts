// Spreadsheet apps execute a cell that starts with = + - @ (or a tab/CR that precedes one) as a
// formula, so a user-chosen name like `=HYPERLINK(...)` would run when an admin opens an export.
// Prefixing an apostrophe makes the cell plain text. Plain numbers (including negatives such as
// "-12.50") are left untouched so amount columns still read as numbers.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

const neutralizeFormula = (value: string): string =>
  FORMULA_PREFIX.test(value) && !PLAIN_NUMBER.test(value) ? `'${value}` : value;

export const escapeCsvField = (value: string): string => {
  const safe = neutralizeFormula(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const toCsvRow = (fields: readonly string[]): string => fields.map(escapeCsvField).join(',');
