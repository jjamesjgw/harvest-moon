'use client';
import React from 'react';
import { FD, FI, FL, T } from '@/lib/constants';
import { reportError } from '@/lib/errorBeacon';

// Route-segment backstop. The in-app ErrorBoundary catches throws inside the
// screen tree and keeps the shell; this catches anything that escapes it —
// a throw in the root shell itself, or during hydration — so the user still
// gets a branded recovery card instead of Next's default error page.
export default function GlobalError({ error, reset }) {
  React.useEffect(() => {
    reportError('app-error-boundary', error);
  }, [error]);

  return <div style={{
    minHeight: '100dvh', background: T.bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '40px 28px',
  }}>
    <div style={{ textAlign: 'center', maxWidth: 420 }}>
      <div style={{
        fontFamily: FL, fontSize: 9, fontWeight: 600,
        letterSpacing: '0.24em', textTransform: 'uppercase', color: T.hot,
      }}>Red flag</div>
      <div style={{
        fontFamily: FD, fontSize: 32, fontWeight: 600,
        letterSpacing: '-0.03em', color: T.ink, marginTop: 8, lineHeight: 1.1,
      }}>Harvest Moon hit a wall</div>
      <div style={{
        fontFamily: FI, fontStyle: 'italic', fontSize: 14, color: T.mute,
        marginTop: 12, lineHeight: 1.55,
      }}>
        The app failed to start. Your league data is safe on the server —
        this is a display problem, not a lost season.
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 26, justifyContent: 'center' }}>
        <button onClick={() => reset()} style={{
          appearance: 'none', cursor: 'pointer',
          background: T.card, color: T.ink,
          border: `0.5px solid ${T.line}`, borderRadius: 3, padding: '12px 18px',
          fontFamily: FL, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.22em', textTransform: 'uppercase',
        }}>Try again</button>
        <button onClick={() => window.location.reload()} style={{
          appearance: 'none', cursor: 'pointer',
          background: T.copperGradient, color: T.ink,
          border: 'none', borderRadius: 3, padding: '12px 18px',
          fontFamily: FL, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.22em', textTransform: 'uppercase',
        }}>Reload</button>
      </div>
    </div>
  </div>;
}
