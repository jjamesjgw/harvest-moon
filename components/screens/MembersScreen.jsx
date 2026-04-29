'use client';
import React, { useState } from 'react';
import { BackChip, PlayerBadge, TopBar } from '@/components/ui/primitives';
import { FB, FD, FI, FL, PALETTE, T } from '@/lib/constants';
import { computeStandings } from '@/lib/utils';

export default function MembersScreen({ state, setState, onBack }) {
  const { players, weeklyResults, currentWeek } = state;
  const standings = computeStandings(players, weeklyResults, currentWeek - 1);
  const sorted = [...standings].sort((a,b) => b.seasonPts - a.seasonPts);
  const [editing, setEditing] = useState(null);

  const updatePlayer = (id, updates) => {
    setState(s => ({
      ...s,
      players: s.players.map(p => p.id === id ? { ...p, ...updates, initial: (updates.name || p.name)[0].toUpperCase() } : p),
    }));
  };

  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle={`${players.length} players`} title="Members" right={<BackChip onClick={onBack}/>}/>
    <div style={{ padding:'14px 20px' }}>
      {sorted.map((p, i) => (
        <div key={p.id} style={{
          padding:'14px 0',
          borderBottom: i === sorted.length-1 ? 'none' : `0.5px solid ${T.line2}`,
        }}>
          {editing === p.id ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <PlayerBadge player={p} size={40}/>
                <input value={p.name} onChange={e => updatePlayer(p.id, { name: e.target.value })}
                  style={{
                    flex:1, padding:'10px 12px', borderRadius:3,
                    border:`0.5px solid ${T.line}`, background: T.card,
                    fontFamily: FB, fontSize:15, fontWeight:500, outline:'none', color: T.ink,
                  }}/>
                <button onClick={() => setEditing(null)} style={{
                  appearance:'none', background: T.ink, color: T.bg, border:'none',
                  padding:'10px 14px', borderRadius:3, cursor:'pointer',
                  fontFamily: FL, fontSize:10, fontWeight:500, letterSpacing:'0.2em', textTransform:'uppercase',
                }}>Done</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.22em', textTransform:'uppercase', color: T.mute }}>Color</div>
                {p.favDriverNum ? (
                  <div style={{
                    fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.ink2, lineHeight:1.5,
                    padding:'8px 12px', background:'rgba(184,147,90,0.08)',
                    border:`0.5px solid rgba(184,147,90,0.25)`, borderRadius:3,
                  }}>
                    {p.name}'s color comes from their favorite driver (#{p.favDriverNum}).
                    To change it, ask {p.name} to update their Profile.
                  </div>
                ) : (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {PALETTE.map(c => (
                      <button key={c} onClick={() => updatePlayer(p.id, { color: c })} style={{
                        appearance:'none', border: p.color === c ? `2px solid ${T.ink}` : '2px solid transparent',
                        background: c, width:28, height:28, borderRadius:'50%', cursor:'pointer', padding:0,
                      }}/>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <PlayerBadge player={p} size={40}/>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily: FD, fontSize:20, fontWeight:600, letterSpacing:'-0.03em' }}>{p.name}</div>
                <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute, marginTop:3 }}>
                  {p.seasonPts} pts · {p.wins} {p.wins === 1 ? 'win' : 'wins'}
                </div>
              </div>
              <button onClick={() => setEditing(p.id)} style={{
                appearance:'none', border:`0.5px solid ${T.line}`, background:'transparent', color: T.ink,
                padding:'7px 12px', borderRadius:3, cursor:'pointer',
                fontFamily: FL, fontSize:10, fontWeight:500, letterSpacing:'0.18em', textTransform:'uppercase',
              }}>Edit</button>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>;
}
