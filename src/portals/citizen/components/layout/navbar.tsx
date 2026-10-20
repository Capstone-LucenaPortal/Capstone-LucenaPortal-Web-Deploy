'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { notificationService, unreadCount } from '@/portals/citizen/features/notifications/lib/notifications';

export default function Nav() {
  const pathname = usePathname();
  const { user, logout, openAuthModal, isPasswordRecovery } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [homeMenuOpen, setHomeMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const homeMenuRef = useRef<HTMLDivElement | null>(null);
  const homeButtonRef = useRef<HTMLButtonElement | null>(null);
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close the mobile panel whenever the route changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setHomeMenuOpen(false);
  }, [pathname]);

  // Unread badge. Refetched on navigation rather than via a realtime
  // subscription — the counts change on a human timescale (a staff decision, a
  // sweeper run), and a socket per visitor is not worth it for a number.
  useEffect(() => {
    if (!mounted || !user) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    notificationService
      .getMine()
      .then((rows) => {
        if (!cancelled) setUnread(unreadCount(rows));
      })
      .catch(() => {
        // A badge is not worth surfacing an error for.
      });
    return () => {
      cancelled = true;
    };
  }, [mounted, user, pathname]);

  // Escape closes whichever panel is open, and returns focus to its trigger.
  useEffect(() => {
    if (!homeMenuOpen && !mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (homeMenuOpen) {
        setHomeMenuOpen(false);
        homeButtonRef.current?.focus();
      }
      if (mobileMenuOpen) {
        setMobileMenuOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [homeMenuOpen, mobileMenuOpen]);

  // Clicking or tabbing away from the disclosure closes it. `focusout` is what
  // makes the keyboard path work: without it, tabbing past the last item leaves
  // an open menu floating over the page with focus somewhere else entirely.
  const closeHomeMenuOnLeave = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setHomeMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!homeMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!homeMenuRef.current?.contains(e.target as Node)) setHomeMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [homeMenuOpen]);

  // A password-recovery session is the temporary one Supabase creates the
  // instant a recovery-email link is opened — valid before the citizen has
  // proven anything beyond "clicked a link in an email." It must not unlock
  // the full authenticated nav (name, Logout, Dashboard, Yellow Card, Incident
  // Report, Book Venue) on ANY page, not just /reset-password — ProtectedRoute
  // bounces them back there, but public pages (home, about, ...) aren't
  // gated and would otherwise still show the full identity-bearing nav.
  if (isPasswordRecovery) {
    return (
      <nav aria-label="Main" className="fixed top-0 left-0 right-0 z-[1000] bg-white border-b-[3px] border-lucena-blue shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px clamp(16px, 4vw, 64px)', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/seal-128.png" alt="Lucena City Seal" className="w-14 h-14 object-contain" />
            <div>
              <div className="font-bold text-xl leading-tight text-lucena-blue">Lucena City</div>
              <div className="text-[11px] text-dark-gray font-semibold tracking-[0.12em] uppercase">Portal</div>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: '#666666' }}>
            Resetting your password
          </div>
        </div>
      </nav>
    );
  }

  const isActive = (path: string) => pathname === path;

  const homeMenuItems = [
    { label: 'About', path: '/about' },
    { label: 'News', path: '/news' },
    { label: 'Announcements', path: '/announcements' },
    { label: 'Explore Lucena', path: '/explore-lucena' },
  ];

  // CONTEXT.md glossary: the citizen files an "Incident Report", not a
  // "Report Issue"; the LCC is "booked", not "reserved".
  const primaryLinks = [
    ...(mounted && user ? [{ label: 'Dashboard', path: '/dashboard' }] : []),
    { label: 'Yellow Card', path: '/yellow-card' },
    { label: 'Incident Report', path: '/incident' },
    { label: 'Book Venue', path: '/lcc' },
  ];

  // Flat list used by the mobile panel
  const mobileLinks = [
    { label: 'Home', path: '/' },
    ...homeMenuItems,
    ...primaryLinks,
  ];

  /** Shared desktop link styling. Real anchors now, so middle-click,
   * open-in-new-tab and crawlers all work — every item used to be a
   * `<button onClick={router.push}>` with no href at all. */
  const deskLink = (path: string): CSSProperties => ({
    background: 'none',
    border: 'none',
    fontSize: 15,
    fontWeight: 500,
    padding: '10px 20px',
    cursor: 'pointer',
    borderRadius: 6,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: isActive(path) ? '#003DA5' : '#333333',
    borderBottom: isActive(path) ? '2px solid #003DA5' : '2px solid transparent',
  });

  return (
    <nav aria-label="Main" className="fixed top-0 left-0 right-0 z-[1000] bg-white border-b-[3px] border-lucena-blue shadow-[0_2px_8px_rgba(0,0,0,0.1)]" suppressHydrationWarning>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px clamp(16px, 4vw, 64px)', width: '100%', boxSizing: 'border-box' }}>
        {/* Logo group — a real link. It was a `div onClick`, so it was
            invisible to the keyboard and unopenable in a new tab. */}
        <Link
          href="/"
          aria-label="Lucena City Portal — home"
          style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, minWidth: 0, textDecoration: 'none' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/seal-128.png"
            alt=""
            aria-hidden="true"
            className="w-14 h-14 object-contain"
          />
          <div>
            <div className="font-bold text-xl leading-tight text-lucena-blue">Lucena City</div>
            <div className="text-[11px] text-dark-gray font-semibold tracking-[0.12em] uppercase">Portal</div>
          </div>
          {/* Divider */}
          <div className="w-px h-10 bg-[#DDDDDD] mx-2 hide-xs" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/BoomLucena.png"
            alt=""
            aria-hidden="true"
            className="h-16 w-auto object-contain hide-xs"
          />
        </Link>

        {/* ===== Desktop navigation ===== */}
        <div className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }} suppressHydrationWarning>
          {/* Home + disclosure. Hover still opens it, but hover is now an
              enhancement rather than the only trigger — a keyboard user could
              focus "Home" and never reach About/News/Announcements/Explore Lucena at all. */}
          <div
            ref={homeMenuRef}
            style={{ position: 'relative' }}
            onMouseEnter={() => setHomeMenuOpen(true)}
            onMouseLeave={() => setHomeMenuOpen(false)}
            onBlur={closeHomeMenuOnLeave}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Link
                href="/"
                aria-current={isActive('/') ? 'page' : undefined}
                style={{ ...deskLink('/'), paddingRight: 6 }}
              >
                Home
              </Link>
              <button
                ref={homeButtonRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={homeMenuOpen}
                aria-label="More pages"
                onClick={() => setHomeMenuOpen((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHomeMenuOpen(true);
                    // Move into the menu so arrow-down behaves as expected.
                    const first = homeMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
                    first?.focus();
                  }
                }}
                style={{ background: 'none', border: 'none', padding: '10px 12px 10px 0', cursor: 'pointer', color: isActive('/') ? '#003DA5' : '#333333', display: 'flex', alignItems: 'center' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transition: 'transform 0.2s', transform: homeMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
            </div>
            <div
              role="menu"
              aria-label="More pages"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                background: 'white',
                border: '1px solid #DDDDDD',
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                minWidth: 200,
                padding: 6,
                zIndex: 1001,
                opacity: homeMenuOpen ? 1 : 0,
                transform: homeMenuOpen ? 'translateY(0)' : 'translateY(-8px)',
                visibility: homeMenuOpen ? 'visible' : 'hidden',
                pointerEvents: homeMenuOpen ? 'auto' : 'none',
                transition: 'opacity 0.2s ease, transform 0.2s ease, visibility 0.2s',
              }}
            >
              {homeMenuItems.map(item => (
                <Link
                  key={item.path}
                  href={item.path}
                  role="menuitem"
                  aria-current={isActive(item.path) ? 'page' : undefined}
                  // Not focusable while the menu is hidden — otherwise these
                  // stay in the tab order behind an invisible panel.
                  tabIndex={homeMenuOpen ? 0 : -1}
                  onClick={() => setHomeMenuOpen(false)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 14, fontWeight: 500, padding: '10px 14px', borderRadius: 4, textDecoration: 'none', color: isActive(item.path) ? '#003DA5' : '#333333' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F5F5F5'; e.currentTarget.style.color = '#003DA5'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = isActive(item.path) ? '#003DA5' : '#333333'; }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {primaryLinks.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              aria-current={isActive(item.path) ? 'page' : undefined}
              style={deskLink(item.path)}
            >
              {item.label}
              {item.path === '/dashboard' && unread > 0 && (
                <span
                  style={{ background: '#DC2626', color: 'white', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 7px', lineHeight: 1.6 }}
                >
                  {unread}
                  <span className="sr-only"> unread notifications</span>
                </span>
              )}
            </Link>
          ))}

          {mounted && (user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 16, paddingLeft: 16, borderLeft: '1px solid #DDDDDD' }}>
              <Link
                href="/profile"
                aria-current={isActive('/profile') ? 'page' : undefined}
                style={{ ...deskLink('/profile'), padding: '10px 16px', gap: 8 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                <span>{user.name}</span>
              </Link>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: 15, fontWeight: 500, padding: '10px 16px', cursor: 'pointer', borderRadius: 6, color: '#333333' }}
                onClick={logout}
              >Logout</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginLeft: 16, paddingLeft: 16, borderLeft: '1px solid #DDDDDD' }}>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: 15, fontWeight: 500, padding: '10px 16px', cursor: 'pointer', borderRadius: 6, color: '#333333' }}
                onClick={() => openAuthModal('login')}
              >Sign In</button>
              <button
                type="button"
                style={{ background: '#F5A623', border: 'none', fontSize: 15, fontWeight: 700, padding: '10px 20px', cursor: 'pointer', borderRadius: 6, color: '#000000' }}
                onClick={() => openAuthModal('signup')}
              >Sign Up</button>
            </div>
          ))}
        </div>

        {/* ===== Mobile hamburger toggle ===== */}
        <button
          ref={hamburgerRef}
          type="button"
          className="nav-hamburger"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-panel"
          onClick={() => setMobileMenuOpen(v => !v)}
          style={{ marginLeft: 'auto', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, background: 'none', border: '1px solid #DDDDDD', borderRadius: 8, cursor: 'pointer', color: '#003DA5', flexShrink: 0 }}
        >
          {mobileMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          )}
        </button>
      </div>

      {/* ===== Mobile navigation panel ===== */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-panel"
          className="nav-mobile-panel"
          style={{ borderTop: '1px solid #EEEEEE', background: 'white', padding: '8px 16px 16px', maxHeight: 'calc(100vh - 88px)', overflowY: 'auto' }}
        >
          {mobileLinks.map(item => (
            <Link
              key={item.path}
              href={item.path}
              aria-current={isActive(item.path) ? 'page' : undefined}
              onClick={() => setMobileMenuOpen(false)}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: isActive(item.path) ? '#F0F5FF' : 'none', fontSize: 16, fontWeight: 600, padding: '14px 12px', borderRadius: 8, textDecoration: 'none', color: isActive(item.path) ? '#003DA5' : '#333333' }}
            >
              {item.label}
              {item.path === '/dashboard' && unread > 0 && (
                <span style={{ marginLeft: 8, background: '#DC2626', color: 'white', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 7px' }}>
                  {unread}
                  <span className="sr-only"> unread notifications</span>
                </span>
              )}
            </Link>
          ))}

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #EEEEEE' }}>
            {mounted && (user ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', fontSize: 16, fontWeight: 600, padding: '14px 12px', borderRadius: 8, textDecoration: 'none', color: '#333333' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  {user.name}
                </Link>
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); logout(); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', fontSize: 16, fontWeight: 600, padding: '14px 12px', cursor: 'pointer', borderRadius: 8, color: '#333333' }}
                >Logout</button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); openAuthModal('login'); }}
                  style={{ flex: 1, background: 'none', border: '1px solid #DDDDDD', fontSize: 15, fontWeight: 600, padding: '12px', cursor: 'pointer', borderRadius: 8, color: '#333333' }}
                >Sign In</button>
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); openAuthModal('signup'); }}
                  style={{ flex: 1, background: '#F5A623', border: 'none', fontSize: 15, fontWeight: 700, padding: '12px', cursor: 'pointer', borderRadius: 8, color: '#000000' }}
                >Sign Up</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
