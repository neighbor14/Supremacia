import { useEffect } from 'react';

/**
 * useIosChromeCollapse
 *
 * iOS Safari in landscape keeps its address bar + bookmarks + bottom toolbar visible,
 * reducing available game area compared to portrait (where the chrome auto-collapses).
 *
 * Two complementary strategies:
 *
 * 1. Scroll trick — briefly makes the body 1 px taller than the visual viewport
 *    so iOS Safari sees scrollable content and auto-collapses its chrome.
 *    Reliable on iOS ≤ 15; partially works on iOS 16/17/18 (Apple increasingly
 *    restricts programmatic chrome hiding).
 *
 * 2. --app-height CSS variable — always tracks window.visualViewport.height
 *    (the real usable height after chrome). Use `height: var(--app-height, 100dvh)`
 *    on any full-height container to guarantee it never overflows the visible area.
 *
 * For a guaranteed zero-chrome experience: install via the PWA onboarding.
 */
export function useIosChromeCollapse() {
  useEffect(() => {
    const ua = navigator.userAgent;
    const isIos =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));

    // Already in PWA standalone — no chrome to collapse
    const isStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    // ── Strategy 2: --app-height always tracks the real visible height ──────
    const updateAppHeight = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${h}px`);
    };
    updateAppHeight();
    window.visualViewport?.addEventListener('resize', updateAppHeight);
    window.addEventListener('resize', updateAppHeight);

    // ── Strategy 1: scroll trick (iOS Safari only) ───────────────────────────
    if (!isIos || isStandalone) {
      return () => {
        window.visualViewport?.removeEventListener('resize', updateAppHeight);
        window.removeEventListener('resize', updateAppHeight);
      };
    }

    const collapseChrome = () => {
      const prev = document.body.style.height;
      document.body.style.height = `${window.innerHeight + 1}px`;
      window.scrollTo({ top: 1, behavior: 'instant' as ScrollBehavior });
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        document.body.style.height = prev;
      }, 80);
    };

    const onOrientationChange = () => setTimeout(collapseChrome, 350);

    let prevLandscape = window.innerWidth > window.innerHeight;
    const onResize = () => {
      const landscape = window.innerWidth > window.innerHeight;
      if (landscape !== prevLandscape) {
        prevLandscape = landscape;
        setTimeout(collapseChrome, 350);
      }
    };

    window.addEventListener('orientationchange', onOrientationChange);
    window.addEventListener('resize', onResize);

    if (window.innerWidth > window.innerHeight) collapseChrome();

    return () => {
      window.visualViewport?.removeEventListener('resize', updateAppHeight);
      window.removeEventListener('resize', updateAppHeight);
      window.removeEventListener('orientationchange', onOrientationChange);
      window.removeEventListener('resize', onResize);
    };
  }, []);
}
