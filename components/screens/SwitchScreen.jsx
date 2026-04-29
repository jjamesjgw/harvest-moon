'use client';
import React from 'react';
import { BackChip, PlayerBadge, TopBar } from '@/components/ui/primitives';
import { FD, FI, FL, T } from '@/lib/constants';

export default function SwitchScreen({ state, me, setMe, onBack }) {
  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle="Currently viewing the league as" title="Switch" right={<BackChip onClick={onBack}/>}/>
    <div style={{ padding:'0 20px 14px', fontFamily: FI, fontStyle:'italic', fontSize:13, color: T.mute, lineHeight:1.5 }}>
      Tap to switch perspective. Useful when a friend hands you the phone.
    </div>
    <div style={{ padding:'0 20px' }}>
      {state.players.map(p => (
        <button key={p.id} onClick={() => { setMe(p); onBack(); }} style={{
          appearance:'none',
          background: me.id === p.id ? T.ink : 'transparent',
          color: me.id === p.id ? T.bg : T.ink,
          border:'none',
          borderBottom: me.id === p.id ? 'none' : `0.5px solid ${T.line2}`,
          borderRadius: me.id === p.id ? 4 : 0,
          marginBottom: me.id === p.id ? 6 : 0,
          padding: me.id === p.id ? '14px 16px' : '14px 0',
          cursor:'pointer', textAlign:'left', width:'100%',
          display:'flex', alignItems:'center', gap:14,
        }}>
          <PlayerBadge player={p} size={32}/>
          <span style={{ flex:1, fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em' }}>{p.name}</span>
          {me.id === p.id && <span style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.22em', textTransform:'uppercase', color: T.hot }}>Active</span>}
        </button>
      ))}
    </div>
  </div>;
}
