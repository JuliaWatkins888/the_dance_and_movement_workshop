// Turns a partial update into Mongo operators: undefined fields are left alone, null fields are
// cleared ($unset) - so an admin can remove an optional value (an end date, an image, a limit)
// rather than only ever overwrite it.
export const toUpdateOperations = (input: object): { $set?: Record<string, unknown>; $unset?: Record<string, ''> } => {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined);
  const set = Object.fromEntries(entries.filter(([, value]) => value !== null));
  const unset = Object.fromEntries(entries.filter(([, value]) => value === null).map(([key]) => [key, ''] as const));
  return {
    ...(Object.keys(set).length > 0 ? { $set: set } : {}),
    ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
  };
};
