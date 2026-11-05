import { createHash } from 'node:crypto';
import type { PolicySnapshotCategory } from '../contracts/policy-consent.contract';

// Keeps only what a person actually reads - ids, icons and timestamps can change without changing
// what they agreed to. Expects categories and items already in display order, as
// PolicyRepository.findAll returns them.
export const toPolicySnapshot = (
  categories: readonly { title: string; items: readonly { title: string; content: string }[] }[],
): PolicySnapshotCategory[] =>
  categories.map((category) => ({
    title: category.title,
    items: category.items.map((item) => ({ title: item.title, content: item.content })),
  }));

// JSON rather than joined strings, so moving text across a title/content boundary can't produce the
// same input as another version.
export const hashPolicies = (snapshot: readonly PolicySnapshotCategory[]): string =>
  createHash('sha256')
    .update(JSON.stringify(snapshot.map((category) => [category.title, category.items.map((item) => [item.title, item.content])])))
    .digest('hex');
