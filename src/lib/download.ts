/**
 * Starts a download built entirely in the browser.
 *
 * Every caller works with data that is already local to the diner. Keeping the
 * object-URL lifetime here ensures each export releases its temporary URL even
 * if a browser rejects the synthetic click.
 */
export function downloadText(contents: string, type: string, filename: string): boolean {
  if (
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return false;
  }

  const url = URL.createObjectURL(new Blob([contents], { type }));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    return true;
  } finally {
    URL.revokeObjectURL(url);
  }
}
