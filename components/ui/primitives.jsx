'use client';
import React, { useState, useEffect, useRef } from 'react';
import { T, FD, FI, FL, FB } from '@/lib/constants';
import { DEFAULT_DRIVERS } from '@/lib/data';
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

export function CarNum({ driver, size = 38, onClick }) {
  const baseStyle = {
    width:size, height:size, borderRadius:4,
    background: driver.primary, color: driver.secondary,
    display:'flex', alignItems:'center', justifyContent:'center',
    fontFamily: FL, fontWeight:700, fontSize: size * 0.5, lineHeight:1,
    letterSpacing:'-0.02em', flexShrink:0,
    border: driver.primary === '#000000' ? '1px solid rgba(255,255,255,0.15)' : 'none',
    boxShadow:'0 1px 0 rgba(0,0,0,0.04)',
  };
  if (onClick) {
    return <button
      onClick={(e) => { e.stopPropagation(); onClick(driver); }}
      style={{ ...baseStyle, appearance:'none', padding:0, cursor:'pointer' }}
      aria-label={`Open ${driver.name || `#${driver.num}`} stats`}
    >{driver.num}</button>;
  }
  return <div style={baseStyle}>{driver.num}</div>;
}

export function PlayerBadge({ player, size = 22, style = {}, onClick }) {
  const baseStyle = {
    width:size, height:size, borderRadius:'50%',
    background: player.color, color:'#fff',
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    fontFamily: FL, fontWeight:600, fontSize: size * 0.45,
    lineHeight:1, flexShrink:0, ...style,
  };
  if (onClick) {
    return <button
      onClick={(e) => { e.stopPropagation(); onClick(player); }}
      style={{ ...baseStyle, appearance:'none', padding:0, cursor:'pointer', border:'none' }}
      aria-label={`Open ${player.name}'s team`}
    >{player.initial || player.name[0].toUpperCase()}</button>;
  }
  return <div style={baseStyle}>{player.initial || player.name[0].toUpperCase()}</div>;
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

// ── CTA tier system ──────────────────────────────────────────────
// The app inherited five distinct button treatments that didn't reliably
// encode meaning: solid dark, solid copper, italic-serif arrow, underlined
// text, outline-on-dark. Users couldn't tell from style alone whether a
// thing was a primary action or a piece of metadata. The tiers below are
// the canonical contract going forward:
//
//   Primary    — the most consequential action on a screen. Solid T.ink
//                background with T.bg text. Used for Sign In, Save &
//                Advance, Done, etc. Already applied bespoke at most
//                sites; we don't sweep them in one go.
//   Secondary  — an important alternative or supporting action. Outline
//                style: transparent bg, T.line border, T.ink text. Used
//                for Cancel buttons, "← Back" exits.
//   Tertiary   — inline navigation between related screens, "see more"
//                affordances. Use the LinkArrow primitive below — a real
//                button (focusable, keyboard-accessible) rendered as a
//                small text+chevron link.
//   Destructive — used only for confirm-destruction actions. Solid red
//                (#C8102E). Currently only the Reset Season modal.
//
// LinkArrow normalizes the "View →" / "All →" / "Manage →" pattern that
// previously existed as raw <span onClick> elements (not focusable, not
// announced as buttons by screen readers). Rendering a real <button>
// with consistent affordance fixes the a11y issue and gives the app one
// place to tune the tertiary CTA look.
export function LinkArrow({ onClick, children, tone = 'light' }) {
  const color = tone === 'dark' ? T.bg : T.ink;
  return <button onClick={onClick} style={{
    appearance:'none', background:'transparent', border:'none', padding:'2px 4px',
    margin:'-2px -4px', // negative margin keeps optical alignment with the section label
    cursor:'pointer', color,
    fontFamily: FI, fontStyle:'italic', fontSize:13,
    letterSpacing:'0.01em', textTransform:'none',
    display:'inline-flex', alignItems:'center', gap:4,
  }}>
    {children}
    <span aria-hidden style={{ fontSize:14, lineHeight:1, transform:'translateY(-1px)' }}>→</span>
  </button>;
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
      right={<BackChip onClick={() => onNav('home')}/>}
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

export function BackChip({ onClick, label = 'Back' }) {
  return <button onClick={onClick} style={{
    appearance:'none',
    border:'none',
    background: T.ink,
    padding:'9px 14px', borderRadius:6, cursor:'pointer',
    fontFamily: FL, fontSize:10, letterSpacing:'0.2em',
    textTransform:'uppercase', color: T.bg, fontWeight:600,
    display:'flex', alignItems:'center', gap:5,
    boxShadow:'0 2px 6px rgba(20,17,13,0.18)',
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
    case 'checkered': return <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 3V21" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
      <rect x="7"  y="4" width="3.5" height="3.5" fill={c}/>
      <rect x="14" y="4" width="3.5" height="3.5" fill={c}/>
      <rect x="10.5" y="7.5" width="3.5" height="3.5" fill={c}/>
      <rect x="17.5" y="7.5" width="3"   height="3.5" fill={c}/>
      <rect x="7"  y="11" width="3.5" height="3.5" fill={c}/>
      <rect x="14" y="11" width="3.5" height="3.5" fill={c}/>
    </svg>;
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
      background:'linear-gradient(180deg, #1c1a16 0%, #14110D 100%)',
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

// Compact "weekly wins" indicator: a checkered flag glyph followed by ×N.
// 0 wins renders the flag in muted gray. 1+ wins highlight in copper.
// Designed for inline use anywhere a season-ranking row needs to show how
// many race wins a player has accumulated, without 8 flag icons wrapping
// the layout. Pairs with `size` for parent contexts (e.g. compact={true}
// gives a smaller variant for the Home top-3).
export function WinsCount({ wins, compact = false, style = {} }) {
  const fontSize = compact ? 10 : 11;
  const iconSize = compact ? 11 : 13;
  const has = wins > 0;
  const color = has ? T.hot : 'rgba(20,17,13,0.25)';
  return <span style={{
    display:'inline-flex', alignItems:'center', gap:3,
    color, fontFamily: FB, fontSize, fontWeight:600,
    fontVariantNumeric:'tabular-nums', letterSpacing:'-0.01em',
    ...style,
  }} title={`${wins} weekly ${wins === 1 ? 'win' : 'wins'}`}>
    <Icon name="checkered" size={iconSize}/>
    <span style={{ marginLeft:1 }}>×{wins}</span>
  </span>;
}

export function OnTheClockBanner({ pickerName, progress, onTap }) {
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
function categorizeSaveError(error, sessionExpired) {
  if (sessionExpired) return 'session';
  const msg = String(error || '').toLowerCase();
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
