'use client';
import React, { useState } from 'react';
import { BackChip, CarNum, PlayerBadge, TopBar } from '@/components/ui/primitives';
import { FB, FD, FI, FL, T } from '@/lib/constants';
import { DEFAULT_DRIVERS } from '@/lib/data';

export default function HistoryScreen({ state, onBack }) {
  const { players, weeklyResults, draftHistory = [] } = state;
  const drivers = [...DEFAULT_DRIVERS, ...Object.values(state.weekDriversExtra || {}).flat()];
  const [expanded, setExpanded] = useState(null);
  const results = weeklyResults.sort((a,b) => b.wk - a.wk);

  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle={`${results.length} completed week${results.length === 1 ? '' : 's'}`} title="History" right={<BackChip onClick={onBack}/>}/>
    <div style={{ padding:'14px 20px 20px' }}>
      {results.length === 0 ? (
        <div style={{ padding:'28px 10px', textAlign:'center', fontFamily: FI, fontStyle:'italic', fontSize:14, color: T.mute }}>
          No past weeks yet. Finish a draft and enter results to build history.
        </div>
      ) : results.map((w, idx) => {
        const h = draftHistory.find(d => d.wk === w.wk);
        const pts = Object.entries(w.pts);
        const topPid = pts.reduce((m, [pid, v]) => (!m || v > m[1]) ? [pid, v] : m, null);
        const winner = topPid ? players.find(p => p.id === topPid[0]) : null;
        const isExp = expanded === w.wk;
        return <div key={w.wk} style={{ borderBottom: idx === results.length-1 ? 'none' : `0.5px solid ${T.line2}` }}>
          <button onClick={() => setExpanded(isExp ? null : w.wk)} style={{
            appearance:'none', width:'100%', background:'transparent', border:'none',
            padding:'14px 0', cursor:'pointer', textAlign:'left',
            display:'flex', alignItems:'center', gap:14,
          }}>
            <div style={{ fontFamily: FL, fontSize:10, fontWeight:500, letterSpacing:'0.2em', textTransform:'uppercase', color: T.mute, width:42 }}>Wk {String(w.wk).padStart(2,'0')}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em' }}>{w.track}</div>
              {winner && <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                <PlayerBadge player={winner} size={14}/>
                <span style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute }}>{winner.name} · {topPid[1]} pts</span>
              </div>}
            </div>
            <div style={{ color: T.mute, fontFamily: FD, fontSize:18, fontStyle:'italic' }}>{isExp ? '—' : '+'}</div>
          </button>
          {isExp && h && <div style={{ paddingBottom:14 }}>
            {players.map((p, i) => {
              const roster = h.picks.filter(pk => pk.playerId === p.id);
              const isTop = topPid && p.id === topPid[0];
              return <div key={p.id} style={{
                padding:'10px 0', display:'flex', alignItems:'center', gap:10,
                borderTop:`0.5px solid ${T.line2}`,
              }}>
                <PlayerBadge player={p} size={18}/>
                <span style={{ fontFamily: FD, fontSize:14, width:66, letterSpacing:'-0.03em' }}>{p.name}</span>
                <div style={{ display:'flex', gap:4, flex:1, flexWrap:'wrap' }}>
                  {roster.map(pk => {
                    const d = drivers.find(dv => dv.num === pk.driverNum);
                    return d && <CarNum key={pk.driverNum} driver={d} size={22}/>;
                  })}
                </div>
                <span style={{ fontFamily: FB, fontSize:13, fontWeight:600, fontVariantNumeric:'tabular-nums', color: isTop ? T.hot : T.ink }}>{w.pts[p.id] || 0}</span>
              </div>;
            })}
          </div>}
          {isExp && !h && <div style={{ padding:'10px 0 14px', fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute }}>
            Draft wasn't recorded for this week.
          </div>}
        </div>;
      })}
    </div>
  </div>;
}
