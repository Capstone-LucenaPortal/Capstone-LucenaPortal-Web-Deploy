'use client';

import { useEffect, useRef, useState } from 'react';

/** Facebook's page plugin will not draw wider than this, whatever it is given. */
const PLUGIN_MAX_WIDTH = 500;

interface FacebookPageFeedProps {
  /** The page's facebook.com address. */
  pageUrl: string;
  /** The iframe's accessible name. */
  title: string;
  /** Pixel height of the feed, before any magnifying. */
  height: number;
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
 * A Facebook page's live timeline, with a link out to the page itself.
 *
 * Page-plugin iframe, not the JS SDK: the timeline renders sandboxed on
 * facebook.com's origin, so no third-party script runs on the portal and CSP
 * only needs frame-src. The plugin fills its container up to 500px wide;
 * with `maxScale` it is drawn at 500px and magnified to fill a wider one.
 */
export default function FacebookPageFeed({ pageUrl, title, height, maxScale }: FacebookPageFeedProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const box = boxRef.current;
    if (!maxScale || !box || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(feedScale(entry.contentRect.width, maxScale));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [maxScale]);

  const params = new URLSearchParams({
    href: pageUrl,
    tabs: 'timeline',
    width: String(PLUGIN_MAX_WIDTH),
    height: String(height),
    small_header: 'false',
    adapt_container_width: 'true',
    hide_cover: 'false',
    show_facepile: 'true',
  });

  const magnified = scale > 1;

  return (
    <div ref={boxRef} style={{ width: '100%', maxWidth: maxScale ? undefined : PLUGIN_MAX_WIDTH }}>
      {/* Magnified, the iframe keeps its 500px layout and is scaled from its
          top-left corner; the wrapper takes the scaled size so the page
          around it makes room. */}
      <div style={magnified ? { width: PLUGIN_MAX_WIDTH * scale, height: height * scale } : undefined}>
        <iframe
          src={`https://www.facebook.com/plugins/page.php?${params.toString()}`}
          width={PLUGIN_MAX_WIDTH}
          height={height}
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
