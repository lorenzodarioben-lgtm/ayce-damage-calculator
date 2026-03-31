import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadText } from '@/lib/download';

const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;

afterEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: originalCreateObjectUrl,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: originalRevokeObjectUrl,
  });
  vi.restoreAllMocks();
});

describe('downloadText', () => {
  it('clicks a temporary download link and releases its object URL', () => {
    const createObjectURL = vi.fn(() => 'blob:ayce-export');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

    const click = vi.fn();
    const link = { href: '', download: '', click } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValue(link);

    expect(downloadText('meal data', 'application/json', 'ayce.json')).toBe(true);
    expect(link.href).toBe('blob:ayce-export');
    expect(link.download).toBe('ayce.json');
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:ayce-export');
  });
});
