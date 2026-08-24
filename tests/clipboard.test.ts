import { afterEach, describe, expect, it, vi } from 'vitest';
import { COPY_UNAVAILABLE, copyToClipboard } from '@/lib/share';

/*
 * Every copy in the app goes through this one function, and most of it only
 * runs where the Clipboard API does not: an insecure origin, an older engine,
 * or a permission the page was refused. That path is otherwise invisible.
 */

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value });
}

function setExecCommand(value: unknown) {
  Object.defineProperty(document, 'execCommand', { configurable: true, value });
}

afterEach(() => {
  if (originalClipboard) {
    Object.defineProperty(navigator, 'clipboard', originalClipboard);
  } else {
    Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'clipboard');
  }
  if (originalExecCommand) {
    Object.defineProperty(document, 'execCommand', originalExecCommand);
  } else {
    Reflect.deleteProperty(document as unknown as Record<string, unknown>, 'execCommand');
  }
});

describe('copyToClipboard', () => {
  it('uses the clipboard API when the browser offers one', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    setExecCommand(vi.fn(() => true));

    await expect(copyToClipboard('brisket')).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith('brisket');
    expect(document.execCommand).not.toHaveBeenCalled();
  });

  it('falls back to a selection where there is no clipboard API', async () => {
    setClipboard(undefined);
    const execCommand = vi.fn(() => true);
    setExecCommand(execCommand);

    await expect(copyToClipboard('brisket')).resolves.toBe(true);

    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('falls back when the clipboard API rejects', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    const execCommand = vi.fn(() => true);
    setExecCommand(execCommand);

    await expect(copyToClipboard('brisket')).resolves.toBe(true);

    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('reports failure rather than claiming a copy that did not happen', async () => {
    setClipboard(undefined);
    setExecCommand(
      vi.fn(() => {
        throw new Error('unsupported');
      }),
    );

    await expect(copyToClipboard('brisket')).resolves.toBe(false);
  });

  it('leaves nothing behind in the document, whichever way it ends', async () => {
    setClipboard(undefined);

    setExecCommand(vi.fn(() => true));
    await copyToClipboard('brisket');
    expect(document.querySelector('textarea')).toBeNull();

    setExecCommand(vi.fn(() => false));
    await copyToClipboard('brisket');
    expect(document.querySelector('textarea')).toBeNull();
  });
});

describe('COPY_UNAVAILABLE', () => {
  it('names the browser as the reason, since nothing else can be', () => {
    expect(COPY_UNAVAILABLE).toBe('Copying is unavailable in this browser.');
  });
});
