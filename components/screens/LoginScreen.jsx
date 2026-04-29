'use client';
import React, { useState } from 'react';
import { ADMIN_PROFILE, FB, FI, FL, FM, PLAYER_PINS, T } from '@/lib/constants';

export default function LoginScreen({ onLogin, players }) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(null);

  const submit = () => {
    const key = name.trim().toLowerCase();
    if (!key || pin.length !== 4) { setErr('Enter your name and 4-digit PIN.'); return; }
    const expected = PLAYER_PINS[key];
    if (!expected) { setErr('Name not recognized.'); return; }
    if (pin !== expected) { setErr('Incorrect PIN.'); return; }
    const account = key === 'admin' ? ADMIN_PROFILE : players.find(p => p.name.toLowerCase() === key);
    if (!account) { setErr('Could not load your profile. Try again.'); return; }
    setErr(null);
    onLogin(account);
  };

  return <div style={{
    minHeight:'100%', flex:1, position:'relative',
    background:'#0a0806',
    backgroundImage:'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(184,147,90,0.18) 0%, transparent 70%), linear-gradient(180deg, #0a0806 0%, #14110D 100%)',
    display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center',
    paddingTop:'max(40px, calc(env(safe-area-inset-top) + 32px))',
    paddingBottom:'max(40px, calc(env(safe-area-inset-bottom) + 32px))',
    paddingLeft:28, paddingRight:28,
    marginLeft:'calc(0px - env(safe-area-inset-left))',
    marginRight:'calc(0px - env(safe-area-inset-right))',
    color: T.bg,
  }}>
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
      marginTop:8, textAlign:'center', lineHeight:1.5, maxWidth:280,
    }}>Sign in with your league name and 4-digit PIN.</div>

    <div style={{ width:'100%', maxWidth:320, marginTop:36, display:'flex', flexDirection:'column', gap:12 }}>
      <input value={name} onChange={e => { setName(e.target.value); setErr(null); }}
        placeholder="Name" autoCapitalize="words" autoCorrect="off"
        style={{
          padding:'15px 18px', boxSizing:'border-box',
          background:'linear-gradient(180deg, #FDFBF5 0%, #EFEBE0 100%)',
          border:`1px solid ${err ? T.hot : 'rgba(184,147,90,0.4)'}`,
          borderRadius:8, outline:'none',
          fontFamily: FB, fontSize:16, fontWeight:500, color: T.ink,
          boxShadow:'inset 0 1px 0 rgba(255,255,255,0.8), 0 4px 16px rgba(0,0,0,0.4)',
        }}/>
      <input type="password" inputMode="numeric" value={pin}
        onChange={e => { setPin(e.target.value.replace(/\D/g,'').slice(0,4)); setErr(null); }}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        placeholder="••••" maxLength={4}
        style={{
          padding:'15px 18px', boxSizing:'border-box', textAlign:'center',
          background:'linear-gradient(180deg, #FDFBF5 0%, #EFEBE0 100%)',
          border:`1px solid ${err ? T.hot : 'rgba(184,147,90,0.4)'}`,
          borderRadius:8, outline:'none',
          fontFamily: FM, fontSize:22, letterSpacing:'0.4em', color: T.ink, fontWeight:600,
          boxShadow:'inset 0 1px 0 rgba(255,255,255,0.8), 0 4px 16px rgba(0,0,0,0.4)',
        }}/>
      {err && <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:13, color: T.hot, textAlign:'center' }}>{err}</div>}
      <button onClick={submit} style={{
        appearance:'none', padding:16,
        background:'linear-gradient(180deg, #C9A268 0%, #B8935A 50%, #9A7A48 100%)',
        color: T.ink, border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, cursor:'pointer',
        fontFamily: FL, fontSize:11, fontWeight:600, letterSpacing:'0.28em', textTransform:'uppercase',
        boxShadow:'inset 0 1px 0 rgba(255,255,255,0.4), 0 6px 20px rgba(0,0,0,0.5)',
      }}>Sign In</button>
    </div>

    <div style={{
      marginTop:36, textAlign:'center',
      fontFamily: FI, fontStyle:'italic', fontSize:11,
      color:'rgba(247,244,237,0.3)',
    }}>{players.length} members · private league</div>
  </div>;
}
