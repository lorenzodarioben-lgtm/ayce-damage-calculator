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

/** Connectivity changes without the event that should have announced it. */
function setOnlineSilently(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online });
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

  /*
   * The bar latched. A worker-backed app paints its shell from cache before the
   * network has settled, so the first reading is often a false "offline"; the
   * matching event can then land before the listener exists, or never fire
   * because the tab was in the background when the connection returned. The
   * result on the deployed site was a permanent offline banner over a working
   * connection, which the three cases below are the cover for.
   */
  it('does not report a network that came back before it started listening', () => {
    /*
     * The initial value is taken during render and the listeners attach after
     * paint. This returns "offline" to that first read and "online" to every
     * one after it, which is the gap itself: the connection returns before any
     * listener exists, so the event that would have cleared the bar is one
     * nobody was there to hear.
     */
    let reads = 0;
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => (reads++ === 0 ? false : true),
    });

    render(<ServiceWorkerManager />);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('re-reads the network when the page is looked at again', () => {
    render(<ServiceWorkerManager />);

    act(() => setOnline(false));
    expect(screen.getByText(/you are offline/i)).toBeInTheDocument();

    // The connection returns while the tab is in the background, so the event
    // that would have cleared this never arrives.
    setOnlineSilently(true);
    act(() => void document.dispatchEvent(new Event('visibilitychange')));

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('re-reads the network when the window is focused again', () => {
    render(<ServiceWorkerManager />);

    act(() => setOnline(false));
    expect(screen.getByText(/you are offline/i)).toBeInTheDocument();

    setOnlineSilently(true);
    act(() => void window.dispatchEvent(new Event('focus')));

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('still says the network is gone when it genuinely is', () => {
    render(<ServiceWorkerManager />);

    act(() => setOnline(false));
    // A look at the page does not wish a connection into existence.
    act(() => void window.dispatchEvent(new Event('focus')));

    expect(screen.getByText(/you are offline/i)).toBeInTheDocument();
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
