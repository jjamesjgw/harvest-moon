'use client';
import React from 'react';
import { BackChip, TopBar } from '@/components/ui/primitives';
import { FB, FD, FI, FL, T } from '@/lib/constants';

export default function ScheduleScreen({ state, onBack }) {
  const { schedule, currentWeek } = state;
  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle="Season 2026" title="Schedule" right={<BackChip onClick={onBack}/>}/>
    <div style={{ padding:'14px 20px 20px' }}>
      {schedule.map((race, idx) => {
        const isNow = race.wk === currentWeek;
        const isPast = race.wk < currentWeek;
        return <div key={race.wk} style={{
          display:'flex', alignItems:'center', gap:14,
          padding:'14px 0',
          borderBottom: idx === schedule.length-1 ? 'none' : `0.5px solid ${T.line2}`,
          opacity: isPast ? 0.45 : 1,
        }}>
          <div style={{ fontFamily: FD, fontSize:22, fontWeight:600, width:36, color: T.ink, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{String(race.wk).padStart(2,'0')}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1.1, color: isNow ? T.hot : T.ink }}>{race.track}</div>
            <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute, marginTop:3 }}>{race.type} · {race.len} mi · {race.laps} laps</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.2em', textTransform:'uppercase', color: isNow ? T.hot : isPast ? T.mute : T.ink2 }}>{isNow ? 'Current' : isPast ? 'Final' : 'Upcoming'}</div>
            <div style={{ fontFamily: FB, fontSize:11, color: T.mute, marginTop:3 }}>{race.date}</div>
          </div>
        </div>;
      })}
    </div>
  </div>;
}
