'use client';
import React from 'react';
import { BackChip, RaceCountdown, TopBar } from '@/components/ui/primitives';
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
          padding:'14px 0',
          borderBottom: idx === schedule.length-1 ? 'none' : `0.5px solid ${T.line2}`,
          opacity: isPast ? 0.45 : 1,
        }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
            <div style={{ fontFamily: FD, fontSize:22, fontWeight:600, width:36, color: T.ink, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{String(race.wk).padStart(2,'0')}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1.1, color: isNow ? T.hot : T.ink }}>
                {race.raceName || race.track}
              </div>
              {race.raceName && <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.ink2, marginTop:3 }}>
                {race.track}
              </div>}
              <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute, marginTop:race.raceName ? 2 : 3 }}>
                {race.type} · {race.len} mi · {race.laps} laps
              </div>
              <div style={{ marginTop:6 }}>
                <RaceCountdown date={race.date} time={race.time} network={race.network} tone="light" showNetwork/>
              </div>
              {race.lastWinner && <div style={{
                marginTop:6, fontFamily: FL, fontSize:9, fontWeight:500,
                letterSpacing:'0.18em', textTransform:'uppercase', color: T.mute,
              }}>2025 · <span style={{ fontFamily: FB, fontSize:11, fontWeight:600, letterSpacing:'-0.005em', textTransform:'none', color: T.ink2 }}>{race.lastWinner}</span></div>}
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.2em', textTransform:'uppercase', color: isNow ? T.hot : isPast ? T.mute : T.ink2 }}>{isNow ? 'Current' : isPast ? 'Final' : 'Upcoming'}</div>
            </div>
          </div>
        </div>;
      })}
    </div>
  </div>;
}
