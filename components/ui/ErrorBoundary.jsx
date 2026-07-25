'use client';
import React from 'react';
import { FD, FI, FL, T } from '@/lib/constants';
import { reportError } from '@/lib/errorBeacon';

// Catches render/lifecycle throws from the screen tree. Without this, any
// throw in one of the 16 screens white-screens the whole PWA with no way back
// but force-quitting the app — and the user has no idea a reload would fix it.
//
// Recovery is genuinely cheap here: all league state lives in Supabase plus a
// localStorage mirror, so nothing is lost by re-rendering or reloading. This
// just gives the user the button.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportError('react-boundary', error, {
      componentStack: String(info?.componentStack || '').slice(0, 2000),
    });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // "Try again" clears the boundary and re-renders the same screen — enough
    // for a transient shape glitch that a fresh realtime payload has already
    // fixed. "Reload" is the bigger hammer.
    return <div style={{ padding: '48px 28px', textAlign: 'center' }}>
      <div style={{
        fontFamily: FL, fontSize: 9, fontWeight: 600,
        letterSpacing: '0.24em', textTransform: 'uppercase', color: T.hot,
      }}>Caution flag</div>
      <div style={{
        fontFamily: FD, fontSize: 28, fontWeight: 600,
        letterSpacing: '-0.03em', color: T.ink, marginTop: 8, lineHeight: 1.1,
      }}>Something broke</div>
      <div style={{
        fontFamily: FI, fontStyle: 'italic', fontSize: 14, color: T.mute,
        marginTop: 10, lineHeight: 1.55,
      }}>
        This screen hit an error. Nothing was lost — your picks are saved on the
        league server. Try again, or reload the app.
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'center' }}>
        <button onClick={() => this.setState({ error: null })} style={btn(false)}>Try again</button>
        <button onClick={() => window.location.reload()} style={btn(true)}>Reload</button>
      </div>
    </div>;
  }
}

function btn(primary) {
  return {
    appearance: 'none', cursor: 'pointer',
    background: primary ? T.copperGradient : T.card,
    color: T.ink,
    border: primary ? 'none' : `0.5px solid ${T.line}`,
    borderRadius: 3, padding: '12px 18px',
    fontFamily: FL, fontSize: 10, fontWeight: 600,
    letterSpacing: '0.22em', textTransform: 'uppercase',
  };
}

export default ErrorBoundary;
