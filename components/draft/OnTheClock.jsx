'use client';
import React from 'react';
import { PlayerBadge } from '@/components/ui/primitives';
import { FD, FI, FL, T } from '@/lib/constants';

// Header banner: who's on the clock + pick count.
export function OnTheClock({ currentPicker, pickIdx, totalPicks, round, totalRounds, myTurn, done, onNav }) {
  if (done) return <div style={{ background: T.good, color:'#fff', borderRadius:4, padding:'16px 18px' }}>
    <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.24em', textTransform:'uppercase', color:'rgba(255,255,255,0.75)' }}>Draft Complete</div>
    <div style={{ fontFamily: FD, fontSize:24, fontWeight:600, letterSpacing:'-0.03em', marginTop:2 }}>Roll out the green flag</div>
  </div>;
  if (!currentPicker) return null;
  return <div style={{
    background: T.ink, color: T.bg, borderRadius:4, padding:'14px 18px',
    display:'flex', alignItems:'center', gap:14,
    border: myTurn ? `2px solid ${T.hot}` : 'none',
  }}>
    <PlayerBadge player={currentPicker} size={36} onClick={() => onNav('team', { playerId: currentPicker.id })}/>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.24em', textTransform:'uppercase', color: myTurn ? T.hot : 'rgba(247,244,237,0.5)' }}>
        {myTurn ? "You're up" : 'On the Clock'} · Round {round}/{totalRounds}
      </div>
      <div style={{ fontFamily: FD, fontSize:22, fontWeight:600, lineHeight:1.05, letterSpacing:'-0.03em', marginTop:2 }}>{currentPicker.name}</div>
    </div>
    <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:13, color:'rgba(247,244,237,0.55)', fontVariantNumeric:'tabular-nums' }}>{pickIdx+1}/{totalPicks}</div>
  </div>;
}
