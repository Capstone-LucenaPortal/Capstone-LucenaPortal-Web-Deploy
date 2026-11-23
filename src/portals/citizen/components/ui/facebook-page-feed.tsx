'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';

/** Facebook's page plugin will not draw wider than this, whatever it is given. */
const PLUGIN_MAX_WIDTH = 500;

/** …nor narrower than this. */
const PLUGIN_MIN_WIDTH = 180;

/** The phone breakpoint, the same one `globals.css` uses for its phone layout. */
const PHONE_QUERY = '(max-width: 640px)';

interface FacebookPageFeedProps {
  /** The page's facebook.com address. */
  pageUrl: string;
  /** The iframe's accessible name. */
  title: string;
  /** Pixel height of the feed, before any magnifying. */
  height: number;
  /** Pixel height of the feed on a phone, where it opens from a toggle. */
  phoneHeight?: number;
  /**
   * Let the feed fill a container wider than the plugin's 500px by magnifying
   * it, up to this factor. Off by default: the feed stays at most 500px wide.
   */
  maxScale?: number;
}

/** How much to magnify a 500px feed to fill `width`, within [1, maxScale]. */
export function feedScale(width: number, maxScale: number): number {
  return Math.min(Math.max(width / PLUGIN_MAX_WIDTH, 1), maxScale);
}

/**
 * The width to ask the plugin for. The plugin draws at exactly the width in
 * its URL, so in a box narrower than that it is cut off on the right. On a
 * phone it gets the box's own width; elsewhere it keeps its 500px, as before.
 */
export function pluginWidth(boxWidth: number, isPhone: boolean): number {
  if (!isPhone || boxWidth <= 0) return PLUGIN_MAX_WIDTH;
  return Math.max(PLUGIN_MIN_WIDTH, Math.min(PLUGIN_MAX_WIDTH, Math.floor(boxWidth)));
}

function subscribeToPhone(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function isPhoneNow(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
}

/**
 * A Facebook page's live timeline, with a link out to the page itself.
 *
 * Page-plugin iframe, not the JS SDK: the timeline renders sandboxed on
 * facebook.com's origin, so no third-party script runs on the portal and CSP
 * only needs frame-src. The plugin fills its container up to 500px wide;
 * with `maxScale` it is drawn at 500px and magnified to fill a wider one.
 *
 * On a phone the feed starts collapsed behind a toggle, so it does not take
 * over the screen. The toggle and the hiding are CSS (`.m-collapse-*` in
 * globals.css), so on a wider screen the feed simply shows, as it always has.
 * A lazy iframe that is hidden is not loaded, so a phone that never opens the
 * feed never fetches it.
 */
export default function FacebookPageFeed({ pageUrl, title, height, phoneHeight = 480, maxScale }: FacebookPageFeedProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const bodyId = useId();
  const [boxWidth, setBoxWidth] = useState(0);
  const isPhone = useSyncExternalStore(subscribeToPhone, isPhoneNow, () => false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      setBoxWidth(entry.contentRect.width);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const width = pluginWidth(boxWidth, isPhone);
  const feedHeight = isPhone ? phoneHeight : height;
  const scale = maxScale && !isPhone ? feedScale(boxWidth, maxScale) : 1;
  const magnified = scale > 1;

  const params = new URLSearchParams({
    href: pageUrl,
    tabs: 'timeline',
    width: String(width),
    height: String(feedHeight),
    small_header: 'false',
    adapt_container_width: 'true',
    hide_cover: 'false',
    show_facepile: 'true',
  });

  return (
    <div ref={boxRef} style={{ width: '100%', maxWidth: maxScale ? undefined : PLUGIN_MAX_WIDTH }}>
      <button
        type="button"
        className="m-collapse-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', alignItems: 'center', gap: 12, padding: '12px 14px',
          background: '#FFFFFF', border: '1px solid #DDDDDD', borderRadius: 8,
          cursor: 'pointer', font: 'inherit', textAlign: 'left',
          marginBottom: open ? 12 : 0,
        }}
      >
        <span
          aria-hidden="true"
          style={{ width: 32, height: 32, borderRadius: '50%', background: '#1877F2', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17, flexShrink: 0 }}
        >
          f
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#003DA5' }}>
          {open ? 'Hide Facebook posts' : 'Show Facebook posts'}
        </span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#003DA5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
          style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div id={bodyId} className="m-collapse-body" data-open={open ? 'true' : 'false'}>
        {/* Magnified, the iframe keeps its 500px layout and is scaled from its
            top-left corner; the wrapper takes the scaled size so the page
            around it makes room. */}
        <div style={magnified ? { width: PLUGIN_MAX_WIDTH * scale, height: height * scale } : undefined}>
          <iframe
            src={`https://www.facebook.com/plugins/page.php?${params.toString()}`}
            width={width}
            height={feedHeight}
            style={{
              border: 'none',
              overflow: 'hidden',
              width: magnified ? PLUGIN_MAX_WIDTH : '100%',
              display: 'block',
              ...(magnified && { transform: `scale(${scale})`, transformOrigin: 'top left' }),
            }}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="encrypted-media"
            title={title}
          />
        </div>
      </div>
      <a
        href={pageUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'inline-block', marginTop: 8, fontSize: 13, color: '#003DA5', textDecoration: 'none' }}
      >
        Open the page on facebook.com →
      </a>
    </div>
  );
}
