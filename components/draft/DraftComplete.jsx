'use client';
import React from 'react';
import { CarNum, PlayerBadge, SectionLabel } from '@/components/ui/primitives';
import { FB, FD, FL, SERIES, T } from '@/lib/constants';
import { getWeekConfig } from '@/lib/utils';

// Draft-complete summary roster view.
// Groups picks by series so bonus drivers are visually distinct from
// Cup picks. Each player shows "Cup [4 chips] · Truck [1 chip] · ..."
export function DraftComplete({ state, onNav, cupDrivers }) {
  const { players, draftState, currentWeek, bonusDriversByWeek = {} } = state;
  const cfg = getWeekConfig(state, currentWeek);
  const bonusPools = bonusDriversByWeek[currentWeek] || {};
  const lookupDriver = (series, num) => {
    if (series === 'Cup') return cupDrivers.find(d => d.num === num);
    return (bonusPools[series] || []).find(d => d.num === num);
  };

  return <div style={{ padding:'14px 20px 24px' }}>
    <SectionLabel>All Rosters</SectionLabel>
    <div style={{ marginTop:14 }}>
      {players.map((p, i) => {
        const myPicks = draftState.picks.filter(pk => pk.playerId === p.id);
        return <div key={p.id} style={{
          padding:'14px 0',
          borderBottom: i === players.length-1 ? 'none' : `0.5px solid ${T.line2}`,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <PlayerBadge player={p} size={22} onClick={() => onNav('team', { playerId: p.id })}/>
            <span style={{ fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em' }}>{p.name}</span>
          </div>
          {Object.keys(cfg.allotments).map(series => {
            const seriesPicks = myPicks.filter(pk => (pk.series || 'Cup') === series);
            if (seriesPicks.length === 0) return null;
            const meta = SERIES[series] || { label: series };
            return <div key={series} style={{ marginBottom:8 }}>
              {series !== 'Cup' && <div style={{
                fontFamily: FL, fontSize:8, fontWeight:600,
                letterSpacing:'0.22em', textTransform:'uppercase',
                color: T.hot, marginBottom:4,
              }}>{meta.label}</div>}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {seriesPicks.map(pk => {
                  const d = lookupDriver(series, pk.driverNum);
                  return d
                    ? <CarNum key={`${series}:${pk.driverNum}`} driver={d} size={32} onClick={series === 'Cup' ? () => onNav('drivers', { driverNum: d.num }) : undefined}/>
                    : <div key={`${series}:${pk.driverNum}`} style={{
                        width:32, height:32, borderRadius:4,
                        background: T.bg2, color: T.mute,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontFamily: FB, fontSize:11, fontWeight:600,
                      }}>#{pk.driverNum}</div>;
                })}
              </div>
            </div>;
          })}
        </div>;
      })}
    </div>
    <div style={{ display:'flex', gap:8, marginTop:18 }}>
      <button onClick={() => onNav('team')} style={{
        appearance:'none', flex:1, padding:14,
        background: T.hot, color: T.ink,
        border:'none', borderRadius:3, cursor:'pointer',
        fontFamily: FL, fontSize:11, fontWeight:600,
        letterSpacing:'0.22em', textTransform:'uppercase',
      }}>My Team</button>
      <button onClick={() => onNav('enter-results')} style={{
        appearance:'none', flex:1, padding:14,
        background: T.ink, color: T.bg, border:'none', borderRadius:3, cursor:'pointer',
        fontFamily: FL, fontSize:11, fontWeight:600,
        letterSpacing:'0.22em', textTransform:'uppercase',
      }}>Enter Results →</button>
    </div>
  </div>;
}
