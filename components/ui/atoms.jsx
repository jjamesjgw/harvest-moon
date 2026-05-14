'use client';
import React from 'react';
import { T, FD, FI, FL, FB } from '@/lib/constants';

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
//                (T.danger). Currently only the Reset Season modal.
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
