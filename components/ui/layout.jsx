'use client';
import React, { useState, useEffect, useRef } from 'react';
import { T, FD, FI, FL, FB } from '@/lib/constants';
import { Icon } from './atoms';

export function TopBar({ title, subtitle, right, style = {} }) {
  return <div style={{
    paddingTop:'max(18px, calc(env(safe-area-inset-top) + 8px))',
    paddingLeft:20, paddingRight:20, paddingBottom:20,
    display:'flex', alignItems:'flex-end',
    justifyContent:'space-between', gap:12, ...style,
  }}>
    <div style={{ minWidth:0, flex:1 }}>
      {subtitle && <div style={{
        fontFamily: FI, fontStyle:'italic', fontSize:13,
        color: T.mute, marginBottom:4, letterSpacing:'0.005em',
      }}>{subtitle}</div>}
      <div style={{
        fontFamily: FD, fontSize:32, fontWeight:700,
        letterSpacing:'-0.03em', color: T.ink, lineHeight:0.95,
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
      }}>{title}</div>
    </div>
    {right}
  </div>;
}

// ─── NAVIGATION ──────────────────────────────────────────────────

const TAB_DEFS = [
  { id:'home',      label:'Home',      icon:'home' },
  { id:'draft',     label:'Draft',     icon:'flag' },
  { id:'standings', label:'Standings', icon:'trophy' },
  { id:'team',      label:'Team',      icon:'helm' },
  { id:'more',      label:'More',      icon:'more' },
];

export function TabBar({ active, onNav }) {
  return <div style={{
    position:'sticky', bottom:0, left:0, right:0,
    background:'linear-gradient(180deg, rgba(253,251,245,0.96) 0%, rgba(239,235,224,0.98) 100%)',
    backdropFilter:'blur(20px) saturate(180%)',
    WebkitBackdropFilter:'blur(20px) saturate(180%)',
    borderTop:'1px solid rgba(184,147,90,0.25)',
    boxShadow:'0 -4px 20px rgba(20,17,13,0.06), inset 0 1px 0 rgba(255,255,255,0.5)',
    paddingBottom:'max(20px, env(safe-area-inset-bottom))', paddingTop:10,
    display:'flex', justifyContent:'space-around', alignItems:'center',
    zIndex:10,
  }}>
    {TAB_DEFS.map(t => {
      const isActive = active === t.id;
      return <button key={t.id} onClick={() => onNav(t.id)} style={{
        appearance:'none', border:0, background:'transparent', padding:'6px 10px',
        display:'flex', flexDirection:'column', alignItems:'center', gap:4,
        cursor:'pointer', color: isActive ? T.hot : T.mute, position:'relative',
      }}>
        <Icon name={t.icon} size={20} filled={isActive}/>
        <span style={{
          fontFamily: FL, fontSize:9, fontWeight: isActive ? 700 : 500,
          letterSpacing:'0.14em', textTransform:'uppercase',
        }}>{t.label}</span>
        {isActive && <div style={{
          position:'absolute', bottom:-10, left:'50%', transform:'translateX(-50%)',
          width:24, height:2, background: T.hot, borderRadius:2,
        }}/>}
      </button>;
    })}
  </div>;
}

// ─── APP CHROME ─────────────────────────────────────────────────

// On wider screens, render in an iPhone-style frame. On narrow (mobile), full bleed.
export function AppFrame({ children }) {
  const [isWide, setIsWide] = useState(typeof window !== 'undefined' && window.innerWidth > 500);
  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth > 500);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!isWide) {
    return <div style={{
      minHeight:'100vh', minHeight:'100dvh',
      background: T.bg,
      display:'flex', flexDirection:'column',
      paddingLeft:'env(safe-area-inset-left)',
      paddingRight:'env(safe-area-inset-right)',
    }}>{children}</div>;
  }
  return <div style={{
    minHeight:'100vh', background:'#0D0B09',
    display:'flex', alignItems:'center', justifyContent:'center',
    padding:'24px 20px',
    backgroundImage:'radial-gradient(ellipse at top, rgba(184,147,90,0.08) 0%, transparent 60%)',
  }}>
    <div style={{
      width: 390, maxWidth:'100%', height:'min(840px, calc(100vh - 48px))',
      background: T.bg, borderRadius: 40, overflow:'hidden',
      boxShadow: `0 40px 80px rgba(0,0,0,0.4), 0 0 0 8px ${T.nav}, 0 0 0 10px #2a251e`,
      display:'flex', flexDirection:'column', position:'relative',
    }}>
      <div style={{
        position:'absolute', top:8, left:'50%', transform:'translateX(-50%)',
        width:110, height:28, background: T.shell, borderRadius:16, zIndex:100,
      }}/>
      <div style={{
        padding:'14px 24px 6px', display:'flex', justifyContent:'space-between', alignItems:'center',
        fontFamily: FB, fontSize:13, fontWeight:600, color: T.ink, flexShrink:0,
      }}>
        <span>9:41</span>
        <span style={{ visibility:'hidden' }}>·</span>
        <span style={{ display:'inline-flex', gap:5, alignItems:'center' }}>
          <svg width="16" height="10" viewBox="0 0 16 10"><path d="M0 7h3v3H0zM4 5h3v5H4zM8 3h3v7H8zM12 1h3v9h-3z" fill="currentColor"/></svg>
          <svg width="22" height="11" viewBox="0 0 22 11" fill="none">
            <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="currentColor" opacity="0.4"/>
            <rect x="2" y="2" width="15" height="7" rx="1" fill="currentColor"/>
            <rect x="19.5" y="3.5" width="1.5" height="4" rx="0.5" fill="currentColor" opacity="0.4"/>
          </svg>
        </span>
      </div>
      {children}
    </div>
  </div>;
}

// Pull-to-refresh wrapper. Renders its children inside a scrollable container.
// On touch devices, dragging down past THRESHOLD when scrolled to the top
// arms the gesture; releasing past it triggers `onRefresh()`. A subtle
// header indicator shows the state ("Pull down" → "Release to refresh" →
// "Refreshing…"). The gesture is only active when scrollTop is 0 to avoid
// hijacking normal vertical scrolls.
//
// onRefresh: async () => void   — caller's data refetch
// disabled:  boolean            — skip the gesture entirely (e.g. during draft)
// busy:      boolean            — caller-controlled "refreshing now" flag
// scrollRef: optional ref       — exposes the inner scroll element to the parent
const PULL_THRESHOLD = 70;
const PULL_MAX = 110;
export const PullToRefresh = React.forwardRef(function PullToRefresh(
  { onRefresh, disabled = false, busy = false, children, style = {} },
  scrollRef,
) {
  const innerRef = useRef(null);
  const ref = scrollRef || innerRef;
  const startYRef = useRef(null);
  const [pull, setPull] = useState(0);   // current pull distance in px
  const [armed, setArmed] = useState(false);

  const onTouchStart = (e) => {
    if (disabled || busy) return;
    const el = ref.current;
    if (!el || el.scrollTop > 0) { startYRef.current = null; return; }
    startYRef.current = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (startYRef.current == null) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy <= 0) { setPull(0); setArmed(false); return; }
    // Resistance curve — drag feels heavy past the threshold so it doesn't
    // stretch all the way down to the bottom of the screen.
    const eased = Math.min(PULL_MAX, dy * 0.55);
    setPull(eased);
    setArmed(eased >= PULL_THRESHOLD);
  };
  const onTouchEnd = async () => {
    const wasArmed = armed;
    startYRef.current = null;
    setPull(0);
    setArmed(false);
    if (wasArmed && !busy && typeof onRefresh === 'function') {
      try { navigator.vibrate?.(20); } catch {}
      await onRefresh();
    }
  };

  // The visible indicator's height matches the pull distance up to threshold,
  // then "snaps" while you keep pulling further. While `busy` is true we hold
  // it open at threshold height with the spinner.
  const indicatorHeight = busy ? PULL_THRESHOLD : Math.min(pull, PULL_MAX);
  const showIndicator = pull > 0 || busy;
  const label = busy ? 'Refreshing…' : armed ? 'Release to refresh' : 'Pull down';

  return <div
    ref={ref}
    onTouchStart={onTouchStart}
    onTouchMove={onTouchMove}
    onTouchEnd={onTouchEnd}
    onTouchCancel={onTouchEnd}
    style={{ position:'relative', ...style }}
  >
    <div style={{
      position:'absolute', top:0, left:0, right:0,
      height: indicatorHeight,
      display:'flex', alignItems:'center', justifyContent:'center',
      gap:8, color: T.mute, pointerEvents:'none',
      transition: busy || pull === 0 ? 'height 200ms ease' : 'none',
      overflow:'hidden',
      opacity: showIndicator ? 1 : 0,
    }}>
      <Spinner spinning={busy} armed={armed}/>
      <span style={{
        fontFamily: FL, fontSize:9, fontWeight:600,
        letterSpacing:'0.22em', textTransform:'uppercase',
        color: armed || busy ? T.hot : T.mute,
      }}>{label}</span>
    </div>
    <div style={{
      transform: `translateY(${indicatorHeight}px)`,
      transition: busy || pull === 0 ? 'transform 200ms ease' : 'none',
    }}>
      {children}
    </div>
  </div>;
});

function Spinner({ spinning, armed }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" style={{
    animation: spinning ? 'hm-spin 0.8s linear infinite' : 'none',
    transform: armed && !spinning ? 'rotate(180deg)' : 'rotate(0deg)',
    transition: 'transform 150ms ease',
  }}>
    <circle cx="12" cy="12" r="9" fill="none"
      stroke={spinning ? T.hot : (armed ? T.hot : T.mute)}
      strokeWidth="2"
      strokeDasharray={spinning ? '14 42' : '57 57'}
      strokeLinecap="round"
    />
    {!spinning && <path d="M8 12L12 16L16 12" fill="none"
      stroke={armed ? T.hot : T.mute}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    />}
  </svg>;
}
