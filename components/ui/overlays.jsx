'use client';
import React, { useState, useEffect } from 'react';
import { T, FD, FI, FL, FB } from '@/lib/constants';
import { DEFAULT_DRIVERS } from '@/lib/data';
import { raceCountdown } from '@/lib/utils';
import { BackChip, PlayerBadge } from './atoms';
import { TopBar } from './layout';

// All-Star weeks suspend the normal draft flow. SlotPickScreen and
// DraftScreen render this paused panel instead — explains the format,
// shows everyone's locked pick, and points the user back home where
// the All-Star hero lives. Re-used so both screens stay in sync.
export function AllStarDraftPaused({ state, me, currentRace, onNav, screenLabel }) {
  // Resolve picks to drivers using the same fallback pattern as elsewhere.
  // DEFAULT_DRIVERS is the canonical Cup pool; bonus/extras don't apply here.
  const picks = currentRace?.allStarPicks || {};
  const pool = state.drivers || DEFAULT_DRIVERS;
  const driverFor = (num) =>
    pool.find(d => d.num === num)
    || DEFAULT_DRIVERS.find(d => d.num === num)
    || { num, name: `#${num}`, primary: T.mute, secondary: T.ink };

  return <div style={{ paddingBottom:20 }}>
    <TopBar
      subtitle={`Wk ${String(state.currentWeek).padStart(2,'0')} · All-Star Race`}
      title={screenLabel || 'Draft Paused'}
      right={<BackChip onClick={() => onNav('back')}/>}
    />
    <div style={{ padding:'0 20px 20px' }}>
      <div style={{
        background: T.ink, color: T.bg, borderRadius:4,
        border:`1px solid ${T.hot}`, overflow:'hidden',
      }}>
        <div style={{ padding:'20px 20px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <span style={{ color: T.hot, fontSize:13, lineHeight:1 }}>★</span>
            <div style={{
              fontFamily: FL, fontSize:9, fontWeight:600,
              letterSpacing:'0.28em', textTransform:'uppercase', color: T.hot,
            }}>Draft Paused · All-Star Week</div>
          </div>
          <div style={{
            fontFamily: FD, fontSize:24, fontWeight:600,
            letterSpacing:'-0.02em', lineHeight:1.1,
          }}>No draft this week.</div>
          <div style={{
            fontFamily: FI, fontStyle:'italic', fontSize:13,
            color:'rgba(247,244,237,0.7)', marginTop:8, lineHeight:1.45,
          }}>
            The All-Star Race uses pre-locked picks — one driver per player. Anyone whose driver wins gets a 50-point bonus, all-or-nothing. The normal draft resumes next week.
          </div>
        </div>
        <div style={{
          padding:'14px 16px 16px',
          borderTop:'0.5px solid rgba(247,244,237,0.08)',
          background:'rgba(247,244,237,0.025)',
        }}>
          <div style={{
            fontFamily: FL, fontSize:9, fontWeight:600,
            letterSpacing:'0.24em', textTransform:'uppercase',
            color:'rgba(247,244,237,0.5)', marginBottom:10, paddingLeft:4,
          }}>Locked Picks</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8 }}>
            {state.players.map(p => {
              const driverNum = picks[p.id];
              const driver = driverNum != null ? driverFor(driverNum) : null;
              const isMe = p.id === me.id;
              return <div key={p.id} style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'8px 10px', borderRadius:3,
                background: isMe ? 'rgba(184,147,90,0.14)' : 'rgba(247,244,237,0.04)',
                border: isMe ? `0.5px solid rgba(184,147,90,0.5)` : `0.5px solid rgba(247,244,237,0.06)`,
                minWidth: 0,
              }}>
                <PlayerBadge player={p} size={22}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{
                    fontFamily: FL, fontSize:8, fontWeight:600,
                    letterSpacing:'0.16em', textTransform:'uppercase',
                    color: isMe ? T.hot : 'rgba(247,244,237,0.55)',
                  }}>{isMe ? 'You' : p.name}</div>
                  <div style={{
                    fontFamily: FB, fontSize:12, fontWeight:600,
                    color:'rgba(247,244,237,0.95)', marginTop:1,
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                  }}>
                    {driver ? <>#{driver.num} {driver.name}</> : <span style={{ color:'rgba(247,244,237,0.4)', fontStyle:'italic' }}>—</span>}
                  </div>
                </div>
              </div>;
            })}
          </div>
        </div>
      </div>
    </div>
  </div>;
}

// ─── BANNERS / TOASTS ────────────────────────────────────────────

// Bottom-anchored toast that surfaces a just-completed pick when the user
// is NOT on the draft screen (so they don't miss the moment something
// happened). Slides up from below the tab bar, sits for ~3s, slides back
// down. Tap to jump to the draft. Auto-dismisses via parent-controlled
// onDismiss after the timer.
//
// The on-the-clock banner already says who's NEXT — this toast completes
// the story by telling the league what just LANDED ("Trey took #5 Larson").
// Together: who-just-acted + who-acts-next = full picture without the user
// needing to be on the draft screen.
export function JustPickedToast({ player, driver, onTap, onDismiss }) {
  const [exiting, setExiting] = useState(false);
  // Auto-fade ~2.6s after mount so the slide-out animation gets to play in
  // the remaining 400ms before parent removes us. The keyed `player+driver`
  // effect ensures rapid back-to-back picks each get their own full timer.
  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 2600);
    const removeTimer = setTimeout(() => onDismiss?.(), 3000);
    return () => { clearTimeout(exitTimer); clearTimeout(removeTimer); };
  }, [player?.id, driver?.num, onDismiss]);

  if (!player || !driver) return null;

  return <button
    onClick={() => { onTap?.(); }}
    style={{
      position:'fixed',
      // Sit just above the tab bar (which ends ~70-90px from bottom on iOS
      // with safe-area). Using calc keeps us clear of the home indicator.
      bottom:'calc(76px + env(safe-area-inset-bottom))',
      left:16, right:16,
      zIndex:50,
      appearance:'none', cursor:'pointer', textAlign:'left',
      background:`linear-gradient(180deg, ${T.nav} 0%, ${T.ink} 100%)`,
      color: T.bg,
      border:'1px solid rgba(184,147,90,0.3)',
      borderRadius:8, padding:'12px 14px',
      boxShadow:'0 12px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(247,244,237,0.06)',
      display:'flex', alignItems:'center', gap:12,
      animation: exiting
        ? 'hm-toastfall 320ms cubic-bezier(0.4,0,1,1) forwards'
        : 'hm-toastrise 280ms cubic-bezier(0.32,0.72,0,1) both',
    }}
  >
    <PlayerBadge player={player} size={28}/>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{
        fontFamily: FL, fontSize:8, fontWeight:600,
        letterSpacing:'0.26em', textTransform:'uppercase',
        color:'rgba(247,244,237,0.55)',
      }}>Just Picked</div>
      <div style={{
        fontFamily: FB, fontSize:13, fontWeight:500, marginTop:2,
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
      }}>
        <span style={{ fontWeight:700 }}>{player.name}</span> took #{driver.num} {driver.name}
      </div>
    </div>
    <span style={{
      fontFamily: FL, fontSize:9, fontWeight:600,
      letterSpacing:'0.22em', textTransform:'uppercase',
      color: T.hot, flexShrink:0,
    }}>View →</span>
  </button>;
}

export function YourTurnToast({ kind, progress, onGo }) {
  return <button onClick={onGo} style={{
    appearance:'none', display:'flex', alignItems:'center', gap:12,
    background: T.copperGradient,
    color: T.ink, border:'1px solid rgba(255,255,255,0.18)',
    paddingTop:'max(10px, env(safe-area-inset-top))',
    paddingLeft:16, paddingRight:14, paddingBottom:10,
    width:'100%', cursor:'pointer', textAlign:'left',
    boxShadow:'inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 16px rgba(0,0,0,0.3)',
    flexShrink:0, animation:'pulse 1.6s ease-in-out infinite',
  }}>
    <div style={{ flex:1 }}>
      <div style={{ fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.26em', textTransform:'uppercase' }}>
        You're on the clock
      </div>
      <div style={{ fontFamily: FD, fontSize:16, fontWeight:600, letterSpacing:'-0.02em', marginTop:2 }}>
        {kind === 'slot' ? 'Pick your draft slot →' : 'Make your driver pick →'}
      </div>
    </div>
    {progress && <div style={{ textAlign:'right', flexShrink:0, marginLeft:8 }}>
      <div style={{
        fontFamily: FL, fontSize:9, fontWeight:600,
        letterSpacing:'0.22em', textTransform:'uppercase',
        color:'rgba(20,17,13,0.55)',
      }}>{progress.label}</div>
      <div style={{
        fontFamily: FB, fontSize:12, fontWeight:600,
        color: T.ink, marginTop:1,
        fontVariantNumeric:'tabular-nums',
      }}>{progress.value}</div>
    </div>}
  </button>;
}

// Live race countdown that re-renders every minute. Renders one of:
//   • "Apr 26 · 3:00 PM ET · in 2d 4h"  (upcoming)
//   • "Apr 26 · 3:00 PM ET · Live now"   (during race)
//   • "Apr 26 · 3:00 PM ET · Final"      (after race)
// Tone (color/label) auto-adjusts. Pass tone='dark' for use over the dark hero card.
export function RaceCountdown({ date, time, network, tone = 'light', showNetwork = true, year }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const cd = raceCountdown(date, time, new Date(), year);
  const dim   = tone === 'dark' ? 'rgba(247,244,237,0.55)' : T.mute;
  const main  = tone === 'dark' ? T.bg : T.ink2;
  const liveColor = T.hot;
  const finalColor = tone === 'dark' ? 'rgba(247,244,237,0.4)' : T.mute;

  return <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
    <span style={{ fontFamily: FB, fontSize:12, fontWeight:500, color: main, fontVariantNumeric:'tabular-nums' }}>
      {date}{time ? ` · ${time}` : ''}
    </span>
    {cd && cd.status === 'upcoming' && <span style={{
      fontFamily: FL, fontSize:9, fontWeight:600,
      letterSpacing:'0.18em', textTransform:'uppercase',
      color: dim, fontVariantNumeric:'tabular-nums',
    }}>· in {cd.label}</span>}
    {cd && cd.status === 'live' && <span style={{
      padding:'2px 7px', background: liveColor, color:'#fff', borderRadius:2,
      fontFamily: FL, fontSize:9, fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase',
      animation:'pulse 1.6s ease-in-out infinite',
    }}>Live now</span>}
    {cd && cd.status === 'final' && <span style={{
      fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.2em',
      textTransform:'uppercase', color: finalColor,
    }}>· Final</span>}
    {showNetwork && network && <span style={{
      padding:'2px 8px', background: tone === 'dark' ? T.hot : 'rgba(20,17,13,0.06)',
      color: tone === 'dark' ? T.ink : T.ink, borderRadius:2,
      fontFamily: FL, fontSize:9, fontWeight:700,
      letterSpacing:'0.2em', textTransform:'uppercase',
    }}>{network}</span>}
  </div>;
}

// Slim status strip for "league members are mid-draft and someone else is on the clock".
// Visible on every screen except the draft itself, so non-pickers know the league is waiting.
// Renders nothing when it's the current user's turn (their own personal toast handles that).
export function OnTheClockBanner({ pickerName, progress, onTap }) {
  if (!pickerName) return null;
  return <button onClick={onTap} style={{
    appearance:'none', display:'flex', alignItems:'center', gap:10,
    background:`linear-gradient(180deg, ${T.ink} 0%, ${T.nav} 100%)`,
    color: T.bg, border:'none',
    paddingTop:'max(8px, env(safe-area-inset-top))',
    paddingLeft:16, paddingRight:14, paddingBottom:8,
    width:'100%', cursor:'pointer', textAlign:'left',
    flexShrink:0, borderBottom:'1px solid rgba(184,147,90,0.3)',
  }}>
    <span style={{ width:7, height:7, borderRadius:'50%', background: T.hot, animation:'pulse 1.6s ease-in-out infinite', flexShrink:0 }}/>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{
        fontFamily: FL, fontSize:9, fontWeight:600,
        letterSpacing:'0.22em', textTransform:'uppercase',
        color:'rgba(247,244,237,0.55)',
      }}>Draft in progress</div>
      <div style={{
        fontFamily: FD, fontSize:14, fontWeight:600,
        letterSpacing:'-0.02em', marginTop:1,
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
      }}>{pickerName} is on the clock</div>
    </div>
    {progress && <div style={{ textAlign:'right', flexShrink:0, marginRight:8 }}>
      <div style={{
        fontFamily: FL, fontSize:9, fontWeight:600,
        letterSpacing:'0.22em', textTransform:'uppercase',
        color:'rgba(247,244,237,0.55)',
      }}>{progress.label}</div>
      <div style={{
        fontFamily: FB, fontSize:11, fontWeight:600,
        color:'rgba(247,244,237,0.85)', marginTop:1,
        fontVariantNumeric:'tabular-nums',
      }}>{progress.value}</div>
    </div>}
    <span style={{
      fontFamily: FL, fontSize:9, fontWeight:600,
      letterSpacing:'0.22em', textTransform:'uppercase',
      color: T.hot, flexShrink:0,
    }}>View →</span>
  </button>;
}

// Map raw error strings + flags to a user-facing category. Friendly copy
// lives in COPY below — keep technical terms out of what the user reads.
//
// We require BOTH `sessionExpired` AND a matching auth-related error
// message before classifying as 'session'. `useLeague` only clears
// `sessionExpired` on a successful write, so after a 401 the user can
// re-sign-in via LoginScreen and immediately hit an unrelated failure
// (network / 5xx) while the flag is still stale — without the message
// check, the banner would keep telling them to sign in again even
// though the live problem is a server outage.
function categorizeSaveError(error, sessionExpired) {
  const msg = String(error || '').toLowerCase();
  const looksLikeAuth =
    msg.includes('session expired') ||
    msg.includes('unauthorized') ||
    msg.includes('please sign in');
  if (sessionExpired && looksLikeAuth) return 'session';
  if (!msg) return 'unknown';
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('could not reach') ||
    msg.includes('refresh failed')
  ) return 'network';
  if (
    msg.includes('bad-json') ||
    msg.includes('bad-state') ||
    msg.includes('bad-write-id') ||
    msg.includes('bad-client-tag') ||
    msg.includes('refused-fresh') ||
    msg.includes('bad-origin')
  ) return 'app-bug';
  if (
    msg.includes('preflight-failed') ||
    msg.includes('upsert-failed') ||
    msg.includes('save failed (5') ||
    msg.includes('save failed (4')
  ) return 'server';
  return 'unknown';
}

const SAVE_BANNER_COPY = {
  session: {
    headline: 'You were signed out.',
    detail: 'Pick your name below to sign back in. Your picks are safe on this device.',
    action: null, // login screen is the action
  },
  network: {
    headline: "You're offline.",
    detail: 'Your picks are safe on this device and will sync when you reconnect.',
    action: 'Retry',
  },
  server: {
    headline: "The league server isn't responding.",
    detail: 'Your picks are safe on this device. Try again in a moment.',
    action: 'Retry',
  },
  'app-bug': {
    headline: 'The app hit a snag.',
    detail: 'Your picks are safe on this device. Please text Justin so he can take a look.',
    action: 'Retry',
  },
  unknown: {
    headline: "Saves aren't going through right now.",
    detail: 'Your picks are safe on this device. Tap Retry — if it keeps happening, text Justin.',
    action: 'Retry',
  },
};

export function SaveBanner({ status, error, sessionExpired, onRetry }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { if (status !== 'error') setDismissed(false); }, [status]);
  if (status !== 'error' || dismissed) return null;
  const category = categorizeSaveError(error, sessionExpired);
  const copy = SAVE_BANNER_COPY[category];
  return <div style={{
    background: 'rgba(200,16,46,0.95)', color: '#FFF',
    paddingTop:'max(8px, env(safe-area-inset-top))',
    paddingLeft:14, paddingRight:14, paddingBottom:8,
    fontFamily: FB, fontSize: 12, lineHeight: 1.3,
    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
  }}>
    <div style={{ flex: 1, fontWeight:500 }}>
      <div>{copy.headline}</div>
      <div style={{ fontFamily: FL, fontWeight: 400, fontSize: 11, marginTop: 2, opacity: 0.92 }}>
        {copy.detail}
      </div>
    </div>
    {copy.action && <button onClick={onRetry} style={{
      appearance:'none', background:'rgba(255,255,255,0.18)',
      border:'0.5px solid rgba(255,255,255,0.5)', color:'#FFF',
      padding:'5px 9px', borderRadius:3, cursor:'pointer',
      fontFamily: FL, fontSize:9, fontWeight:500,
      letterSpacing:'0.18em', textTransform:'uppercase', flexShrink:0,
    }}>{copy.action}</button>}
    <button onClick={() => setDismissed(true)} aria-label="Dismiss" style={{
      appearance:'none', background:'transparent', border:'none', color:'rgba(255,255,255,0.7)',
      cursor:'pointer', fontSize:18, lineHeight:1, flexShrink:0,
      // 44pt minimum hit area for iOS — wraps the small × glyph.
      width:44, height:44, display:'flex', alignItems:'center', justifyContent:'center',
    }}>×</button>
  </div>;
}
