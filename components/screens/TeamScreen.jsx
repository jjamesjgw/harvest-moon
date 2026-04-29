'use client';
import React, { useMemo, useState } from 'react';
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

  const pastRosters = draftHistory
    .filter(h => h.wk < currentWeek)
    .sort((a, b) => b.wk - a.wk)
    .map(h => ({
      wk: h.wk,
      track: h.track,
      picks: h.picks.filter(p => p.playerId === me.id).map(p => p.driverNum),
    }));

  const weeklyResult = state.weeklyResults || [];
  const [expanded, setExpanded] = useState(null);

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
      <SectionLabel right={<span style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, textTransform:'none', letterSpacing:'0.01em', color: T.mute }}>{pastRosters.length} week{pastRosters.length === 1 ? '' : 's'} · tap to expand</span>}>Past Rosters</SectionLabel>
      <div style={{ padding:'14px 20px 20px' }}>
        {pastRosters.map((r, idx) => {
          const wkResult = weeklyResult.find(w => w.wk === r.wk);
          const pts = wkResult?.pts[me.id];
          const isExp = expanded === r.wk;
          const lastIdx = idx === pastRosters.length - 1;
          return <div key={r.wk} style={{ borderBottom: lastIdx ? 'none' : `0.5px solid ${T.line2}` }}>
            <button onClick={() => setExpanded(isExp ? null : r.wk)} style={{
              appearance:'none', width:'100%', background:'transparent', border:'none',
              padding:'14px 0', cursor:'pointer', textAlign:'left',
              display:'flex', alignItems:'center', gap:14,
            }}>
              <div style={{ fontFamily: FL, fontSize:10, fontWeight:500, letterSpacing:'0.2em', textTransform:'uppercase', color: T.mute, width:42 }}>Wk {String(r.wk).padStart(2,'0')}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em' }}>{r.track}</div>
                <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, color: T.mute, marginTop:3 }}>
                  {r.picks.length} driver{r.picks.length === 1 ? '' : 's'}{pts != null ? ` · ${pts} pts` : ''}
                </div>
              </div>
              {pts != null && <div style={{ fontFamily: FB, fontSize:14, fontWeight:600, color: T.hot, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.01em' }}>{pts}</div>}
              <div style={{ color: T.mute, fontFamily: FD, fontSize:18, fontStyle:'italic' }}>{isExp ? '—' : '+'}</div>
            </button>
            {isExp && <div style={{ padding:'4px 0 14px', display:'flex', gap:6, flexWrap:'wrap' }}>
              {r.picks.map(num => {
                const d = drivers.find(dv => dv.num === num);
                return d && <div key={num} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background: T.card, border:`0.5px solid ${T.line2}`, borderRadius:4 }}>
                  <CarNum driver={d} size={28}/>
                  <span style={{ fontFamily: FD, fontSize:13, fontWeight:600, letterSpacing:'-0.02em' }}>{d.name}</span>
                </div>;
              })}
            </div>}
          </div>;
        })}
      </div>
    </>}
  </div>;
}
