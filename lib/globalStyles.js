'use client';
import { useEffect } from 'react';
import { FB, T } from './constants';

const FONT_HREF =
  'https://fonts.googleapis.com/css2?' +
  'family=Archivo:wght@400;500;600;700;900&' +
  'family=Archivo+Narrow:wght@500;600;700&' +
  'family=Fraunces:ital,wght@0,400;1,400;1,500&' +
  'family=JetBrains+Mono:wght@400;500&' +
  'family=Manrope:wght@300;400;500;600;700&display=swap';

const GLOBAL_CSS = `
  html, body, #root { margin:0; padding:0; background:${T.shell}; min-height:100vh; }
  body { font-family: ${FB}; -webkit-font-smoothing: antialiased; overscroll-behavior: none; overflow-x: hidden; }
  * { box-sizing: border-box; scrollbar-width: none; -ms-overflow-style: none; }
  *::-webkit-scrollbar { width: 0; height: 0; display: none; }
  button { font-family: inherit; }
  input::placeholder { color: rgba(20,17,13,0.35); }
  /* Keyboard focus rings. :focus-visible only paints the ring when the
     user is navigating with a keyboard or assistive tech, never on mouse
     click — so we don't change the look for the 99% touch path while
     still being keyboard-accessible. The 2px copper outline + 2px offset
     reads against both the cream and dark surfaces in the app. */
  :focus { outline: none; }
  button:focus-visible,
  a:focus-visible,
  input:focus-visible,
  textarea:focus-visible,
  [tabindex]:focus-visible {
    outline: 2px solid #B8935A;
    outline-offset: 2px;
    border-radius: inherit;
  }
  @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.85; } }
  @keyframes hm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  /* Skeleton shimmer — used during cold-start while we wait for the
     league row to arrive from Supabase. Slow + low-amplitude so it reads
     as "loading" without strobing. The opacity bounce is more readable
     than a sliding gradient on cream backgrounds. */
  @keyframes hm-shimmer {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 0.85; }
  }
  /* Freshly-taken draft card: a brief copper ring pulse signaling that
     somebody else just locked in this driver. Tied to draftState.picks
     growth in DraftScreen. */
  @keyframes hm-pickring {
    0%   { box-shadow: 0 0 0 0 rgba(184,147,90,0.55); }
    60%  { box-shadow: 0 0 0 6px rgba(184,147,90,0.0); }
    100% { box-shadow: 0 0 0 6px rgba(184,147,90,0.0); }
  }
  /* The owner tag (TONE / SOUP / etc.) slides in from the right edge of
     the card on first render, instead of just popping into existence. */
  @keyframes hm-tagslide {
    from { transform: translateX(10px); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
  }
  /* Toast slide — bottom-anchored "just picked" notification rises into
     view from below the tab bar, then slides back out. Used for surfacing
     real-time picks on screens other than the draft itself. */
  @keyframes hm-toastrise {
    from { transform: translateY(20px); opacity: 0; }
    to   { transform: translateY(0);   opacity: 1; }
  }
  @keyframes hm-toastfall {
    from { transform: translateY(0);   opacity: 1; }
    to   { transform: translateY(20px); opacity: 0; }
  }
`;

// Injects fonts and base CSS exactly once per page lifetime.
export function useGlobalStyles() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!document.getElementById('__hm-fonts')) {
      const link = document.createElement('link');
      link.id = '__hm-fonts';
      link.rel = 'stylesheet';
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    if (!document.getElementById('__hm-style')) {
      const style = document.createElement('style');
      style.id = '__hm-style';
      style.textContent = GLOBAL_CSS;
      document.head.appendChild(style);
    }
  }, []);
}
