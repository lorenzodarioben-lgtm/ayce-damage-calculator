/**
 * Creates a record identifier. `crypto.randomUUID` needs a secure context, so
 * the fallback keeps local features working over plain HTTP on a phone.
 */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
