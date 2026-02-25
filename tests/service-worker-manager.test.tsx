import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceWorkerManager } from '@/components/pwa/ServiceWorkerManager';

/*
 * The bar has three independent things it can say and is absent from the DOM
 * when it has none of them. Registration itself only runs in a production
 * build, so what is exercised here is the part a visitor actually sees.
 */

const originalMatchMedia = window.matchMedia;

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

function setStandalone(standalone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('display-mode: standalone') ? standalone : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function fireInstallPrompt(prompt = vi.fn().mockResolvedValue(undefined)) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  Object.assign(event, { prompt });
  act(() => void window.dispatchEvent(event));
  return { event, prompt };
}

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  window.matchMedia = originalMatchMedia;
});

describe('ServiceWorkerManager', () => {
  it('renders nothing while there is nothing to report', () => {
    setOnline(true);
    const { container } = render(<ServiceWorkerManager />);

    // Absent rather than an empty bar, so it takes up no space at the top of
    // every page.
    expect(container).toBeEmptyDOMElement();
  });

  it('says the network is gone, and what that still leaves available', () => {
    render(<ServiceWorkerManager />);

    act(() => setOnline(false));

    expect(screen.getByText(/you are offline/i)).toBeInTheDocument();
    expect(screen.getByText(/previously visited pages may remain available/i)).toBeInTheDocument();
  });

  it('goes quiet again when the network comes back', () => {
    render(<ServiceWorkerManager />);

    act(() => setOnline(false));
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => setOnline(true));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('offers the install the browser held back, and hands it on when asked', async () => {
    const user = userEvent.setup();
    setStandalone(false);
    render(<ServiceWorkerManager />);

    const { event, prompt } = fireInstallPrompt();

    // Taken over from the browser's own bar so it can be offered in context.
    expect(event.defaultPrevented).toBe(true);
    await user.click(screen.getByRole('button', { name: /install app/i }));
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /install app/i })).toBeNull();
  });

  it('does not leave a retryable button when the browser withdraws its prompt', async () => {
    const user = userEvent.setup();
    setStandalone(false);
    render(<ServiceWorkerManager />);

    const prompt = vi.fn().mockRejectedValue(new Error('Prompt is no longer available'));
    fireInstallPrompt(prompt);
    await user.click(screen.getByRole('button', { name: /install app/i }));

    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /install app/i })).toBeNull();
  });

  it('does not offer to install an app that is already installed', () => {
    setStandalone(true);
    render(<ServiceWorkerManager />);

    fireInstallPrompt();

    expect(screen.queryByRole('button', { name: /install app/i })).toBeNull();
  });
});
