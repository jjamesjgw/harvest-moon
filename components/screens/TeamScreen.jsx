'use client';
import React, { useMemo } from 'react';
import { BackChip, CarNum, DriverRow, SectionLabel, TopBar } from '@/components/ui/primitives';
import { FB, FD, FI, FL, T } from '@/lib/constants';
import { DEFAULT_DRIVERS } from '@/lib/data';
import { makeDriverWeekData } from '@/lib/utils';

export default function TeamScreen({ state, me, onNav }) {
  const { schedule, currentWeek, draftState, draftHistory = [] } = state;
  const drivers = [...DEFAULT_DRIVERS, ...Object.values(state.weekDriversExtra || {}).flat()];
  const myPicks = (draftState?.picks || []).filter(p => p.playerId === me.id);
  const weekDrivers = useMemo(() => makeDriverWeekData(drivers, currentWeek * 100 + drivers.length), [drivers, currentWeek]);
  const myDrivers = myPicks.map(pk => weekDrivers.find(d => d.num === pk.driverNum)).filter(Boolean);

  const pastRosters = draftHistory.filter(h => h.wk < currentWeek).sort((a,b) => b.wk - a.wk).map(h => ({
    wk: h.wk,
    track: h.track,
    picks: h.picks.filter(p => p.playerId === me.id).map(p => p.driverNum),
  }));

  const weeklyResult = state.weeklyResults || [];

  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle={`${me.name} · Week ${String(currentWeek).padStart(2,'0')}`} title="My Team" right={<BackChip onClick={() => onNav('home')}/>}/>

    <SectionLabel>This Week's Roster</SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      {myDrivers.length === 0 ? (
        <div style={{ padding:'28px 20px', textAlign:'center', borderTop:`0.5px solid ${T.line}`, borderBottom:`0.5px solid ${T.line}` }}>
          <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:15, color: T.mute }}>{(draftState?.phase === 'done') ? 'No picks this week' : 'Draft in progress'}</div>
          <button onClick={() => onNav('draft')} style={{
            appearance:'none', marginTop:14,
            background: T.ink, color: T.bg,
            border:'none', padding:'10px 18px', borderRadius:3, cursor:'pointer',
            fontFamily: FL, fontSize:10, fontWeight:500,
            letterSpacing:'0.2em', textTransform:'uppercase',
          }}>Go to Draft →</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {myDrivers.map(d => (
            <DriverRow key={d.num} driver={d}/>
          ))}
        </div>
      )}
    </div>

    {pastRosters.length > 0 && <>
      <SectionLabel>Past Rosters</SectionLabel>
      <div style={{ padding:'14px 20px 20px' }}>
        {pastRosters.map((r, idx) => {
          const wkResult = weeklyResult.find(w => w.wk === r.wk);
          const pts = wkResult?.pts[me.id];
          return <div key={r.wk} style={{
            padding:'14px 0',
            borderBottom: idx === pastRosters.length-1 ? 'none' : `0.5px solid ${T.line2}`,
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
              <div>
                <span style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.22em', textTransform:'uppercase', color: T.mute, marginRight:10 }}>Wk {String(r.wk).padStart(2,'0')}</span>
                <span style={{ fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em' }}>{r.track}</span>
              </div>
              {pts != null && <div style={{ fontFamily: FB, fontSize:14, fontWeight:600, color: T.hot, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.01em' }}>{pts} pts</div>}
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {r.picks.map(num => {
                const d = drivers.find(dv => dv.num === num);
                return d && <CarNum key={num} driver={d} size={28}/>;
              })}
            </div>
          </div>;
        })}
      </div>
    </>}
  </div>;
}
