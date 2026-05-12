'use client';
import React, { useState, useEffect, useRef } from 'react';
import { ADMIN_PROFILE, FB, FD, FI, FL, FM, T } from '@/lib/constants';
import { supabase } from '@/lib/supabase';

// Tile-based login. Six player avatars in a 3×2 grid + a discreet "Admin"
// link below. Tapping a tile selects that player and reveals the PIN field;
// the tile gets a copper ring + a soft scale to confirm the selection.
//
// This replaces the old "type your name" input which was the single biggest
// recurring friction point in the app — typos, capitalization mismatches,
// and 5 seconds of typing on every cold-start. With persistent login + this
// tile picker, the worst-case flow is one tap + four digits.
//
// Admin is intentionally a separate flow (not a 7th tile) because it carries
// different weight than a player account. Admin login swaps the entire
// player grid for a single centered Admin card, so the PIN appears next to
// the thing the user just tapped — no scrolling, no spatial confusion.
export default function LoginScreen({ onLogin, players }) {
  const [mode, setMode] = useState('players');           // 'players' | 'admin'
  const [selectedKey, setSelectedKey] = useState(null);  // lowercased name (player mode only)
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(null);
  const pinRef = useRef(null);

  // Auto-focus PIN whenever a selection is made. The 60ms delay lets the
  // tile's ring/scale transition kick in before the keyboard rises so the
  // focal element doesn't fight the keyboard mid-animation on iOS.
  const activeKey = mode === 'admin' ? 'admin' : selectedKey;
  useEffect(() => {
    if (!activeKey) return;
    const t = setTimeout(() => pinRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [activeKey]);

  // Verify PIN against the server-side `verify_pin` Postgres function. The
  // function reads bcrypt-hashed PINs from a table that's locked off from
  // anon entirely; only this function (SECURITY DEFINER) can read it.
  // Returns one of:
  //   { ok: true }                   — PIN matched
  //   { ok: false }                  — PIN didn't match (auth failure)
  //   { ok: false, transport: true } — couldn't reach server (network/outage)
  // The transport branch surfaces a distinct user message so people know to
  // retry instead of staring at "Incorrect PIN" during a Supabase blip.
  const verifyServerSide = async (name, candidatePin) => {
    try {
      const { data, error } = await supabase.rpc('verify_pin', { p_name: name, p_pin: candidatePin });
      if (error) return { ok: false, transport: true };
      return { ok: data === true };
    } catch {
      return { ok: false, transport: true };
    }
  };

  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    if (!activeKey) { setErr('Choose your tile to start.'); return; }
    if (pin.length !== 4) { setErr('PIN is 4 digits.'); return; }
    setBusy(true);
    try {
      const account = activeKey === 'admin'
        ? ADMIN_PROFILE
        : players.find(p => p.name.toLowerCase() === activeKey);
      if (!account) { setErr('Could not load your profile. Try again.'); return; }

      const result = await verifyServerSide(activeKey, pin);
      if (result.ok) {
        setErr(null);
        onLogin(account);
        return;
      }
      setErr(result.transport
        ? 'Sign-in is offline. Try again in a moment.'
        : 'Incorrect PIN.');
    } finally {
      setBusy(false);
    }
  };

  const selectPlayer = (key) => {
    setSelectedKey(key);
    setPin('');
    setErr(null);
    try { navigator.vibrate?.(15); } catch {}
  };

  const enterAdminMode = () => {
    setMode('admin');
    setSelectedKey(null);
    setPin('');
    setErr(null);
    try { navigator.vibrate?.(15); } catch {}
  };

  const exitAdminMode = () => {
    setMode('players');
    setSelectedKey(null);
    setPin('');
    setErr(null);
  };

  const selectedPlayer = mode === 'players' && selectedKey
    ? players.find(p => p.name.toLowerCase() === selectedKey)
    : null;

  return <div style={{
    minHeight:'100%', flex:1, position:'relative',
    background:'#0a0806',
    backgroundImage:'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(184,147,90,0.18) 0%, transparent 70%), linear-gradient(180deg, #0a0806 0%, #14110D 100%)',
    display:'flex', flexDirection:'column',
    paddingTop:'max(40px, calc(env(safe-area-inset-top) + 32px))',
    paddingBottom:'max(40px, calc(env(safe-area-inset-bottom) + 32px))',
    paddingLeft:24, paddingRight:24,
    marginLeft:'calc(0px - env(safe-area-inset-left))',
    marginRight:'calc(0px - env(safe-area-inset-right))',
    color: T.bg,
  }}>
    {/* Header */}
    <div style={{ textAlign:'center', flexShrink:0 }}>
      <div style={{
        fontFamily: FL, fontSize:10, fontWeight:500,
        letterSpacing:'0.36em', textTransform:'uppercase',
        color:'rgba(247,244,237,0.45)',
      }}>Harvest Moon</div>
      <div style={{
        fontFamily: FI, fontStyle:'italic', fontSize:30,
        color: T.bg, marginTop:6, letterSpacing:'-0.01em',
      }}>Welcome back.</div>
      <div style={{
        fontFamily: FB, fontSize:13, color:'rgba(247,244,237,0.45)',
        marginTop:8, lineHeight:1.5, maxWidth:280, marginLeft:'auto', marginRight:'auto',
      }}>{mode === 'admin'
        ? 'Commissioner sign-in.'
        : 'Tap your tile, then enter your PIN.'}</div>
    </div>

    {/* Picker region — either player grid or admin card */}
    <div style={{
      width:'100%', maxWidth:360, marginLeft:'auto', marginRight:'auto',
      marginTop:32,
    }}>
      {mode === 'players' ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
          {players.map(p => {
            const key = p.name.toLowerCase();
            const isSel = selectedKey === key;
            return <button key={p.id} onClick={() => selectPlayer(key)} style={{
              appearance:'none', cursor:'pointer',
              background: isSel
                ? 'linear-gradient(180deg, #FDFBF5 0%, #EFEBE0 100%)'
                : 'linear-gradient(180deg, rgba(253,251,245,0.08) 0%, rgba(253,251,245,0.04) 100%)',
              border: isSel ? `2px solid ${T.hot}` : `1px solid rgba(247,244,237,0.12)`,
              borderRadius:10,
              padding:'14px 6px 12px', position:'relative', overflow:'hidden',
              display:'flex', flexDirection:'column', alignItems:'center', gap:8,
              transform: isSel ? 'scale(1.03)' : 'scale(1)',
              transition:'transform 180ms cubic-bezier(0.32,0.72,0,1), background 220ms ease, border-color 220ms ease',
              boxShadow: isSel
                ? '0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.6)'
                : '0 2px 8px rgba(0,0,0,0.2)',
            }}>
              {/* Color stripe at the top — same livery-strip language used in DraftGrid driver cards */}
              <div style={{
                position:'absolute', top:0, left:0, right:0, height:3,
                background: p.color,
              }}/>
              <div style={{
                width:48, height:48, borderRadius:'50%',
                background: p.color, color:'#fff',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily: FL, fontWeight:600, fontSize:22, lineHeight:1,
                boxShadow:'inset 0 1px 0 rgba(255,255,255,0.25)',
              }}>{p.initial || p.name[0].toUpperCase()}</div>
              <div style={{
                fontFamily: FD, fontSize:14, fontWeight:600,
                letterSpacing:'-0.02em', lineHeight:1,
                color: isSel ? T.ink : T.bg,
              }}>{p.name}</div>
            </button>;
          })}
        </div>
      ) : (
        // Admin card — single full-width tile in the same family as the player tiles
        <div style={{
          background:'linear-gradient(180deg, #FDFBF5 0%, #EFEBE0 100%)',
          border:`2px solid ${T.hot}`,
          borderRadius:10,
          padding:'20px 18px', position:'relative', overflow:'hidden',
          display:'flex', alignItems:'center', gap:14,
          boxShadow:'0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.6)',
        }}>
          <div style={{
            position:'absolute', top:0, left:0, right:0, height:3, background: T.ink,
          }}/>
          <div style={{
            width:52, height:52, borderRadius:'50%',
            background: T.ink, color: T.bg,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily: FL, fontWeight:600, fontSize:24, lineHeight:1,
            boxShadow:'inset 0 1px 0 rgba(255,255,255,0.15)',
          }}>A</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontFamily: FL, fontSize:9, fontWeight:600,
              letterSpacing:'0.24em', textTransform:'uppercase', color: T.hot,
            }}>Commissioner</div>
            <div style={{
              fontFamily: FD, fontSize:22, fontWeight:600, letterSpacing:'-0.03em',
              color: T.ink, lineHeight:1, marginTop:4,
            }}>Admin</div>
          </div>
        </div>
      )}

      {/* PIN field — slides into view once a tile/card is active */}
      <div style={{
        overflow:'hidden',
        maxHeight: activeKey ? 220 : 0,
        opacity: activeKey ? 1 : 0,
        transition:'max-height 280ms cubic-bezier(0.32,0.72,0,1), opacity 220ms ease',
        marginTop: activeKey ? 18 : 0,
      }}>
        <div style={{
          fontFamily: FL, fontSize:9, fontWeight:600,
          letterSpacing:'0.28em', textTransform:'uppercase',
          color:'rgba(247,244,237,0.55)', textAlign:'center', marginBottom:10,
        }}>
          {mode === 'admin' ? 'Admin' : selectedPlayer?.name || ''} · enter PIN
        </div>
        <input ref={pinRef} type="password" inputMode="numeric" value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g,'').slice(0,4)); setErr(null); }}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="••••" maxLength={4}
          autoComplete="off"
          style={{
            width:'100%', boxSizing:'border-box', padding:'15px 18px', textAlign:'center',
            background:'linear-gradient(180deg, #FDFBF5 0%, #EFEBE0 100%)',
            border:`1px solid ${err ? T.hot : 'rgba(184,147,90,0.4)'}`,
            borderRadius:8, outline:'none',
            fontFamily: FM, fontSize:22, letterSpacing:'0.4em', color: T.ink, fontWeight:600,
            boxShadow:'inset 0 1px 0 rgba(255,255,255,0.8), 0 4px 16px rgba(0,0,0,0.4)',
          }}/>
        {err && <div style={{
          fontFamily: FI, fontStyle:'italic', fontSize:13, color: T.hot,
          textAlign:'center', marginTop:10,
        }}>{err}</div>}
        <button onClick={submit} disabled={busy} style={{
          appearance:'none', width:'100%', marginTop:12, padding:16,
          background:'linear-gradient(180deg, #C9A268 0%, #B8935A 50%, #9A7A48 100%)',
          color: T.ink, border:'1px solid rgba(255,255,255,0.15)', borderRadius:8,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.65 : 1,
          fontFamily: FL, fontSize:11, fontWeight:600, letterSpacing:'0.28em', textTransform:'uppercase',
          boxShadow:'inset 0 1px 0 rgba(255,255,255,0.4), 0 6px 20px rgba(0,0,0,0.5)',
          transition:'opacity 200ms ease',
        }}>{busy ? 'Verifying…' : 'Sign In'}</button>
      </div>
    </div>

    {/* Bottom region — admin toggle + meta line */}
    <div style={{ flex:1, minHeight:24 }}/>
    <div style={{ textAlign:'center', flexShrink:0 }}>
      {mode === 'players' ? (
        <button onClick={enterAdminMode} style={{
          appearance:'none', background:'transparent', border:'none',
          color:'rgba(247,244,237,0.5)', cursor:'pointer',
          fontFamily: FI, fontStyle:'italic', fontSize:13,
          padding:'10px 16px',
          textDecoration:'underline', textDecorationColor:'rgba(247,244,237,0.2)',
          textUnderlineOffset:'4px',
        }}>Sign in as Admin →</button>
      ) : (
        <button onClick={exitAdminMode} style={{
          appearance:'none', background:'transparent', border:'none',
          color:'rgba(247,244,237,0.5)', cursor:'pointer',
          fontFamily: FI, fontStyle:'italic', fontSize:13,
          padding:'10px 16px',
        }}>← Back to player tiles</button>
      )}
      <div style={{
        marginTop:8,
        fontFamily: FI, fontStyle:'italic', fontSize:11,
        color:'rgba(247,244,237,0.3)',
      }}>{players.length} members · private league</div>
    </div>
  </div>;
}
