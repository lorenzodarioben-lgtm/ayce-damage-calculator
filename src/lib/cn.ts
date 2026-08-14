type ClassValue = string | false | null | undefined;

/** Minimal class joiner; the project has no need for a full variant library. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
