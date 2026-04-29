'use client';
import { useEffect } from 'react';
import { FB } from './constants';

const FONT_HREF =
  'https://fonts.googleapis.com/css2?' +
  'family=Archivo:wght@400;500;600;700;900&' +
  'family=Archivo+Narrow:wght@500;600;700&' +
  'family=Fraunces:ital,wght@0,400;1,400;1,500&' +
  'family=JetBrains+Mono:wght@400;500&' +
  'family=Manrope:wght@300;400;500;600;700&display=swap';

const GLOBAL_CSS = `
  html, body, #root { margin:0; padding:0; background:#0a0806; min-height:100vh; }
  body { font-family: ${FB}; -webkit-font-smoothing: antialiased; overscroll-behavior: none; overflow-x: hidden; }
  * { box-sizing: border-box; scrollbar-width: none; -ms-overflow-style: none; }
  *::-webkit-scrollbar { width: 0; height: 0; display: none; }
  button { font-family: inherit; }
  input::placeholder { color: rgba(20,17,13,0.35); }
  @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.85; } }
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
