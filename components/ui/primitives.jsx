'use client';
import React, { useState, useEffect } from 'react';
import { T, FD, FI, FL, FB } from '@/lib/constants';
import { raceCountdown } from '@/lib/utils';

// ─── BASIC ATOMS ─────────────────────────────────────────────────

export function Chip({ children, color, bg, style = {} }) {
  return <span style={{
    display:'inline-flex', alignItems:'center', gap:4,
    padding:'3px 8px', borderRadius:3,
    fontFamily: FL, fontSize:9, fontWeight:500,
    letterSpacing:'0.14em', textTransform:'uppercase',
    background: bg || 'rgba(20,17,13,0.05)', color: color || T.ink2, ...style,
  }}>{children}</span>;
}

export function CarNum({ driver, size = 38 }) {
  return <div style={{
    width:size, height:size, borderRadius:4,
    background: driver.primary, color: driver.secondary,
    display:'flex', alignItems:'center', justifyContent:'center',
    fontFamily: FL, fontWeight:700, fontSize: size * 0.5, lineHeight:1,
    letterSpacing:'-0.02em', flexShrink:0,
    border: driver.primary === '#000000' ? '1px solid rgba(255,255,255,0.15)' : 'none',
    boxShadow:'0 1px 0 rgba(0,0,0,0.04)',
  }}>{driver.num}</div>;
}

export function PlayerBadge({ player, size = 22, style = {} }) {
  return <div style={{
    width:size, height:size, borderRadius:'50%',
    background: player.color, color:'#fff',
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    fontFamily: FL, fontWeight:600, fontSize: size * 0.45,
    lineHeight:1, flexShrink:0, ...style,
  }}>{player.initial || player.name[0].toUpperCase()}</div>;
}

export function SectionLabel({ children, right, style = {} }) {
  return <div style={{
    display:'flex', justifyContent:'space-between', alignItems:'baseline',
    padding:'0 20px',
    fontFamily: FL, fontSize:10, fontWeight:500,
    letterSpacing:'0.22em', textTransform:'uppercase',
    color: T.mute, ...style,
  }}>
    <span>{children}</span>
    {right && <span>{right}</span>}
  </div>;
}

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

export function BackChip({ onClick, label = 'Back' }) {
  return <button onClick={onClick} style={{
    appearance:'none',
    border:'1px solid rgba(184,147,90,0.45)',
    background:'linear-gradient(180deg, #FDFBF5 0%, #EFEBE0 100%)',
    padding:'9px 14px', borderRadius:6, cursor:'pointer',
    fontFamily: FL, fontSize:10, letterSpacing:'0.2em',
    textTransform:'uppercase', color: T.ink, fontWeight:600,
    display:'flex', alignItems:'center', gap:5,
    boxShadow:'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 3px rgba(20,17,13,0.12)',
  }}>← {label}</button>;
}

// ─── ICONS ───────────────────────────────────────────────────────

export function Icon({ name, size = 22, filled }) {
  const c = 'currentColor';
  switch(name) {
    case 'home':   return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M3 11L12 4L21 11V20A1 1 0 0 1 20 21H15V14H9V21H4A1 1 0 0 1 3 20V11Z" stroke={c} strokeWidth="1.6" fill={filled?c:'none'} strokeLinejoin="round"/></svg>;
    case 'flag':   return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M5 3V21" stroke={c} strokeWidth="1.8" strokeLinecap="round"/><rect x="7" y="4" width="4" height="4" fill={filled?c:'none'} stroke={c} strokeWidth="1.4"/><rect x="11" y="4" width="4" height="4" fill={c} opacity={filled?1:0.3}/><rect x="15" y="4" width="4" height="4" fill={filled?c:'none'} stroke={c} strokeWidth="1.4"/><rect x="7" y="8" width="4" height="4" fill={c} opacity={filled?1:0.3}/><rect x="11" y="8" width="4" height="4" fill={filled?c:'none'} stroke={c} strokeWidth="1.4"/><rect x="15" y="8" width="4" height="4" fill={c} opacity={filled?1:0.3}/></svg>;
    case 'trophy': return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M7 4H17V10A5 5 0 0 1 7 10V4Z" fill={filled?c:'none'} stroke={c} strokeWidth="1.6"/><path d="M17 5H20V7A3 3 0 0 1 17 10" stroke={c} strokeWidth="1.6"/><path d="M7 5H4V7A3 3 0 0 0 7 10" stroke={c} strokeWidth="1.6"/><path d="M10 15H14V20H10V15Z" stroke={c} strokeWidth="1.6" fill={filled?c:'none'}/><path d="M8 20H16" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>;
    case 'helm':   return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M4 12C4 7 7 4 12 4C17 4 20 7 20 12V15H4V12Z" fill={filled?c:'none'} stroke={c} strokeWidth="1.6"/><rect x="4" y="15" width="16" height="4" rx="1" fill={filled?c:'none'} stroke={c} strokeWidth="1.6"/><path d="M9 12V10M15 12V10" stroke={c} strokeWidth="1.6" strokeLinecap="round"/></svg>;
    case 'more':   return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="6" cy="12" r="1.6" fill={c}/><circle cx="12" cy="12" r="1.6" fill={c}/><circle cx="18" cy="12" r="1.6" fill={c}/></svg>;
    default:       return null;
  }
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

// ─── DRIVER + MENU ROWS ──────────────────────────────────────────

export function DriverRow({ driver, right, dim, onClick }) {
  return <div onClick={onClick} style={{
    display:'flex', alignItems:'center', gap:12,
    padding:'10px 14px', background: T.card,
    borderRadius:6, border:`0.5px solid ${T.line2}`,
    opacity: dim ? 0.45 : 1,
    textDecoration: dim ? 'line-through' : 'none',
    cursor: onClick ? 'pointer' : 'default',
  }}>
    <CarNum driver={driver} size={32}/>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontFamily: FD, fontSize:16, fontWeight:600, color: T.ink, lineHeight:1.1, letterSpacing:'-0.02em' }}>{driver.name}</div>
      <div style={{ fontFamily: FB, fontSize:11, color: T.mute, marginTop:2 }}>№ {driver.num} · {driver.team}</div>
    </div>
    {right}
  </div>;
}

export function MenuRow({ label, sub, onClick, last }) {
  return <button onClick={onClick} style={{
    appearance:'none', background:'transparent', border:'none',
    borderBottom: last ? 'none' : `0.5px solid ${T.line2}`,
    padding:'14px 0', cursor:'pointer', textAlign:'left',
    display:'flex', alignItems:'center', gap:14, width:'100%',
  }}>
    <div style={{ flex:1 }}>
      <div style={{ fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em', color: T.ink, lineHeight:1.1 }}>{label}</div>
      <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute, marginTop:3 }}>{sub}</div>
    </div>
    <div style={{ color: T.mute, fontFamily: FI, fontStyle:'italic', fontSize:16 }}>→</div>
  </button>;
}

// ─── FORM INPUTS ─────────────────────────────────────────────────

export function Field({ label, value, onChange, placeholder, multiline }) {
  const Tag = multiline ? 'textarea' : 'input';
  return <label style={{ display:'block' }}>
    <div style={{
      fontFamily: FL, fontSize:9, fontWeight:500,
      letterSpacing:'0.22em', textTransform:'uppercase', color: T.mute, marginBottom:6,
    }}>{label}</div>
    <Tag value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      rows={multiline ? 2 : undefined}
      style={{
        width:'100%', boxSizing:'border-box', padding:'11px 14px',
        borderRadius:3, border:`0.5px solid ${T.line}`, background: T.card,
        fontSize:15, color: T.ink, outline:'none',
        resize: multiline ? 'none' : undefined,
        fontStyle: multiline ? 'italic' : 'normal',
        fontFamily: multiline ? FI : FB,
      }}/>
  </label>;
}

export function LabeledInput({ label, value, onChange, placeholder }) {
  return <div style={{ flex:1 }}>
    <div style={{
      fontFamily: FL, fontSize:8, fontWeight:500, letterSpacing:'0.2em',
      textTransform:'uppercase', color: T.mute, marginBottom:4,
    }}>{label}</div>
    <input type="number" inputMode="numeric" value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{
        width:'100%', boxSizing:'border-box', padding:'7px 10px',
        border:`0.5px solid ${T.line}`, borderRadius:3, background: T.card,
        fontFamily: FB, fontSize:14, fontWeight:500, color: T.ink, outline:'none',
      }}/>
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
      boxShadow: '0 40px 80px rgba(0,0,0,0.4), 0 0 0 8px #1c1a16, 0 0 0 10px #2a251e',
      display:'flex', flexDirection:'column', position:'relative',
    }}>
      <div style={{
        position:'absolute', top:8, left:'50%', transform:'translateX(-50%)',
        width:110, height:28, background:'#0a0806', borderRadius:16, zIndex:100,
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

// ─── BANNERS / TOASTS ────────────────────────────────────────────

export function YourTurnToast({ kind, onGo }) {
  return <button onClick={onGo} style={{
    appearance:'none', display:'flex', alignItems:'center', gap:12,
    background:'linear-gradient(180deg, #C9A268 0%, #B8935A 50%, #9A7A48 100%)',
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
export function OnTheClockBanner({ pickerName, onTap }) {
  if (!pickerName) return null;
  return <button onClick={onTap} style={{
    appearance:'none', display:'flex', alignItems:'center', gap:10,
    background:'linear-gradient(180deg, #14110D 0%, #1c1a16 100%)',
    color:'#F7F4ED', border:'none',
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
    <span style={{
      fontFamily: FL, fontSize:9, fontWeight:600,
      letterSpacing:'0.22em', textTransform:'uppercase',
      color: T.hot, flexShrink:0,
    }}>View →</span>
  </button>;
}

export function SaveBanner({ status, error, onRetry }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { if (status !== 'error') setDismissed(false); }, [status]);
  if (status !== 'error' || dismissed) return null;
  return <div style={{
    background: 'rgba(200,16,46,0.95)', color: '#FFF',
    paddingTop:'max(8px, env(safe-area-inset-top))',
    paddingLeft:14, paddingRight:14, paddingBottom:8,
    fontFamily: FB, fontSize: 12, lineHeight: 1.3,
    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
  }}>
    <div style={{ flex: 1, fontWeight:500 }}>
      Saves not syncing. Your data is backed up locally on this device.
    </div>
    <button onClick={onRetry} style={{
      appearance:'none', background:'rgba(255,255,255,0.18)',
      border:'0.5px solid rgba(255,255,255,0.5)', color:'#FFF',
      padding:'5px 9px', borderRadius:3, cursor:'pointer',
      fontFamily: FL, fontSize:9, fontWeight:500,
      letterSpacing:'0.18em', textTransform:'uppercase', flexShrink:0,
    }}>Retry</button>
    <button onClick={() => setDismissed(true)} style={{
      appearance:'none', background:'transparent', border:'none', color:'rgba(255,255,255,0.7)',
      padding:'4px 6px', cursor:'pointer', fontSize:18, lineHeight:1, flexShrink:0,
    }}>×</button>
  </div>;
}
