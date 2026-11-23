import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FacebookPageFeed, { feedScale, pluginWidth } from './facebook-page-feed';

describe('feedScale', () => {
  it('magnifies the 500px feed to fill a wider column', () => {
    expect(feedScale(750, 1.8)).toBe(1.5);
  });

  it('stops at the largest magnification allowed', () => {
    expect(feedScale(1200, 1.8)).toBe(1.8);
  });

  it('never shrinks the feed: a narrow column gets the plugin at its own size', () => {
    expect(feedScale(390, 1.8)).toBe(1);
  });
});

describe('pluginWidth', () => {
  it('keeps the plugin at 500px off a phone, whatever the box', () => {
    expect(pluginWidth(416, false)).toBe(500);
  });

  it('draws the plugin at the box width on a phone, so it is not cut off', () => {
    expect(pluginWidth(358.6, true)).toBe(358);
  });

  it("never goes below Facebook's 180px minimum", () => {
    expect(pluginWidth(150, true)).toBe(180);
  });

  it('never goes past 500px, and falls back to it before the box is measured', () => {
    expect(pluginWidth(700, true)).toBe(500);
    expect(pluginWidth(0, true)).toBe(500);
  });
});

function feed() {
  return render(
    <FacebookPageFeed pageUrl="https://www.facebook.com/example" title="Example feed" height={640} phoneHeight={480} />,
  );
}

function iframeParams(): URLSearchParams {
  const iframe = screen.getByTitle('Example feed') as HTMLIFrameElement;
  return new URL(iframe.src).searchParams;
}

describe('FacebookPageFeed', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts collapsed behind a phone-only toggle, with the feed still in the page for desktop', () => {
    feed();
    const toggle = screen.getByRole('button', { name: 'Show Facebook posts' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveClass('m-collapse-toggle');

    const body = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(body).toHaveClass('m-collapse-body');
    expect(body).toHaveAttribute('data-open', 'false');
    expect(body).toContainElement(screen.getByTitle('Example feed'));
  });

  it('opens and closes from the toggle', async () => {
    const user = userEvent.setup();
    feed();
    await user.click(screen.getByRole('button', { name: 'Show Facebook posts' }));

    const toggle = screen.getByRole('button', { name: 'Hide Facebook posts' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(toggle.getAttribute('aria-controls') ?? '')).toHaveAttribute('data-open', 'true');

    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Show Facebook posts' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('asks Facebook for the desktop size off a phone', () => {
    feed();
    expect(iframeParams().get('width')).toBe('500');
    expect(iframeParams().get('height')).toBe('640');
  });

  it('asks Facebook for the box width and the phone height on a phone', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(max-width: 640px)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe() {
          this.callback([{ contentRect: { width: 358 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
        }
        disconnect() {}
      },
    );

    feed();
    expect(iframeParams().get('width')).toBe('358');
    expect(iframeParams().get('height')).toBe('480');
  });
});
