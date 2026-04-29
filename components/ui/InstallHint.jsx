'use client';
import React, { useState, useEffect } from 'react';
import { T, FB, FD, FI, FL } from '@/lib/constants';

const DISMISS_KEY = 'harvest-moon:install-hint-dismissed';

// Detects iOS Safari running in a regular tab (not standalone PWA). Returns
// false on Android, desktop, or once already installed to home screen.
function shouldShowIosHint() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  // Treat iPadOS (which spoofs Mac UA but supports touch) as iOS too
  const isIpadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (!isIos && !isIpadOs) return false;
  // Already installed → standalone display mode
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (standalone) return false;
  return true;
}

// Friendly nudge for iOS users to add the app to their home screen.
// Renders inline on Home (not at the page level), dismissible per-device.
export function InstallHint() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY)) {
        setDismissed(true);
        return;
      }
    } catch {}
    setShow(shouldShowIosHint());
  }, []);

  if (dismissed || !show) return null;

  const dismiss = () => {
    setDismissed(true);
    try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  return <div style={{ padding:'0 20px 16px' }}>
    <div style={{
      background: T.card, border:`0.5px solid rgba(184,147,90,0.3)`,
      borderRadius:6, padding:'14px 16px', position:'relative',
      boxShadow:'0 1px 3px rgba(20,17,13,0.04)',
    }}>
      <button onClick={dismiss} aria-label="Dismiss" style={{
        position:'absolute', top:0, right:0,
        appearance:'none', background:'transparent', border:'none',
        color: T.mute, fontSize:18, cursor:'pointer', lineHeight:1,
        // 44×44 minimum hit area per iOS HIG. The visible × stays small via
        // padding rather than scaling up the glyph itself.
        width:44, height:44,
        display:'flex', alignItems:'center', justifyContent:'center',
        paddingTop:6, paddingRight:8,
      }}>×</button>
      <div style={{
        fontFamily: FL, fontSize:9, fontWeight:600,
        letterSpacing:'0.24em', textTransform:'uppercase', color: T.hot,
      }}>Install on iPhone</div>
      <div style={{
        fontFamily: FD, fontSize:16, fontWeight:600,
        letterSpacing:'-0.02em', marginTop:4, color: T.ink, paddingRight:16,
      }}>Add Harvest Moon to your Home Screen</div>
      <div style={{
        fontFamily: FI, fontStyle:'italic', fontSize:13,
        color: T.ink2, marginTop:6, lineHeight:1.4,
      }}>
        Tap <strong style={{ fontFamily: FB, fontStyle:'normal', fontWeight:600 }}>Share</strong>{' '}
        <span aria-hidden style={{ display:'inline-flex', verticalAlign:'middle', margin:'0 2px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ display:'block' }}>
            <path d="M12 3V15M12 3L8 7M12 3L16 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 12V19A2 2 0 0 0 7 21H17A2 2 0 0 0 19 19V12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </span>
        in Safari, then{' '}
        <strong style={{ fontFamily: FB, fontStyle:'normal', fontWeight:600 }}>Add to Home Screen</strong>.
        Opens full-screen, no Safari bar, with its own icon.
      </div>
    </div>
  </div>;
}
