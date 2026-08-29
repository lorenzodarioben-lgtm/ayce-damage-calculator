/** A small, local-only label set keeps a history card useful without becoming a taxonomy. */
export const MAX_SESSION_TAGS = 5;
export const MAX_SESSION_TAG_LENGTH = 32;

/**
 * Normalises tags at every boundary, so searching a card uses the same identity
 * as editing one. Lowercase avoids duplicate labels that differ only by case.
 */
export function normaliseSessionTag(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const tag = value.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  return tag.length > 0 && tag.length <= MAX_SESSION_TAG_LENGTH ? tag : null;
}

/** Drops malformed/duplicate values and bounds the collection deterministically. */
export function parseSessionTags(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const tag = normaliseSessionTag(entry);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
    if (tags.length >= MAX_SESSION_TAGS) {
      break;
    }
  }
  return tags;
}
