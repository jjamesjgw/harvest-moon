'use client';
import React from 'react';
import { BackChip, CarNum, PlayerBadge, SectionLabel, TopBar } from '@/components/ui/primitives';
import { FB, FD, FI, FL, T } from '@/lib/constants';
import { DEFAULT_DRIVERS } from '@/lib/data';

export default function RecapScreen({ state, onNav }) {
  const { players, weeklyResults, draftHistory = [] } = state;
  const drivers = [...DEFAULT_DRIVERS, ...Object.values(state.weekDriversExtra || {}).flat()];
  if (weeklyResults.length === 0) {
    return <div style={{ paddingBottom:20 }}>
      <TopBar title="Race Recap" right={<BackChip onClick={() => onNav('more')}/>}/>
      <div style={{ padding:'40px 28px', textAlign:'center' }}>
        <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:16, color: T.mute, lineHeight:1.5 }}>
          No completed races yet. Once you finish the first week, the recap will appear here.
        </div>
      </div>
    </div>;
  }
  const last = weeklyResults.sort((a,b) => b.wk - a.wk)[0];
  const sortedRes = players.map(p => ({ ...p, pts: last.pts[p.id] || 0 })).sort((a,b) => b.pts - a.pts);
  const hist = draftHistory.find(h => h.wk === last.wk);

  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle={`Wk ${String(last.wk).padStart(2,'0')} · Final`} title="Race Recap" right={<BackChip onClick={() => onNav('more')}/>}/>

    <div style={{ padding:'0 20px 20px' }}>
      <div style={{ background: T.ink, color: T.bg, borderRadius:4, padding:'22px 20px' }}>
        <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.24em', textTransform:'uppercase', color:'rgba(247,244,237,0.4)' }}>Track</div>
        <div style={{ fontFamily: FD, fontSize:40, fontWeight:600, lineHeight:1, letterSpacing:'-0.03em', marginTop:4 }}>{last.track}</div>
        <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:14, color:'rgba(247,244,237,0.6)', marginTop:10 }}>
          <span style={{ color: T.bg }}>{sortedRes[0].name}</span> took the week · {sortedRes[0].pts} pts
        </div>
      </div>
    </div>

    <SectionLabel>Week Results</SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      {sortedRes.map((p, i) => (
        <div key={p.id} style={{
          display:'flex', alignItems:'center', gap:14,
          padding:'12px 0',
          borderBottom: i === sortedRes.length-1 ? 'none' : `0.5px solid ${T.line2}`,
        }}>
          <div style={{ fontFamily: FD, fontSize:18, fontWeight:600, width:22, color: i === 0 ? T.hot : T.ink, fontVariantNumeric:'tabular-nums' }}>{String(i+1).padStart(2,'0')}</div>
          <PlayerBadge player={p} size={24}/>
          <div style={{ flex:1, fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em' }}>{p.name}</div>
          <div style={{ fontFamily: FB, fontSize:15, fontWeight: i === 0 ? 600 : 500, fontVariantNumeric:'tabular-nums', color: i === 0 ? T.hot : T.ink }}>{p.pts}</div>
        </div>
      ))}
    </div>

    {hist && <>
      <SectionLabel>Rosters · How it Broke Down</SectionLabel>
      <div style={{ padding:'14px 20px 20px' }}>
        {[...players]
          .sort((a, b) => (last.pts[b.id] || 0) - (last.pts[a.id] || 0))
          .map((p, i, arr) => {
            const roster = hist.picks.filter(pk => pk.playerId === p.id);
            return <div key={p.id} style={{
              padding:'14px 0',
              borderBottom: i === arr.length-1 ? 'none' : `0.5px solid ${T.line2}`,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <PlayerBadge player={p} size={20}/>
                <span style={{ fontFamily: FD, fontSize:16, fontWeight:600, letterSpacing:'-0.03em' }}>{p.name}</span>
                <span style={{ marginLeft:'auto', fontFamily: FB, fontSize:14, fontWeight:500, fontVariantNumeric:'tabular-nums' }}>{last.pts[p.id] || 0} pts</span>
              </div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {roster.map(pk => {
                  const d = drivers.find(dv => dv.num === pk.driverNum);
                  return d && <CarNum key={pk.driverNum} driver={d} size={26}/>;
                })}
              </div>
            </div>;
          })}
      </div>
    </>}
  </div>;
}
