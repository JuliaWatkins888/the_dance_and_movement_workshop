// Untrusted search input used directly in a $regex filter needs escaping first - without it,
// regex metacharacters in the search term could throw (malformed pattern) or change the query's
// meaning in unexpected ways. Standard MDN-documented escape, shared by every repository that
// supports free-text search (user.repository.ts, page.repository.ts).
export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
