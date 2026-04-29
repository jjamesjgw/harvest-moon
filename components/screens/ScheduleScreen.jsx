'use client';
import React from 'react';
import { BackChip, RaceCountdown, TopBar } from '@/components/ui/primitives';
import { TrackShape } from '@/components/ui/TrackShape';
import { FB, FD, FI, FL, SERIES, T } from '@/lib/constants';
import { getWeekConfig } from '@/lib/utils';

export default function ScheduleScreen({ state, onBack }) {
  const { schedule, currentWeek } = state;
  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle="Season 2026" title="Schedule" right={<BackChip onClick={onBack}/>}/>
    <div style={{ padding:'14px 20px 20px' }}>
      {schedule.map((race, idx) => {
        const isNow = race.wk === currentWeek;
        const isPast = race.wk < currentWeek;
        const cfg = getWeekConfig(state, race.wk);
        const hasBonus = cfg.bonusSeries.length > 0;
        return <div key={race.wk} style={{
          padding:'14px 0',
          borderBottom: idx === schedule.length-1 ? 'none' : `0.5px solid ${T.line2}`,
          opacity: isPast ? 0.45 : 1,
        }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
            <div style={{ fontFamily: FD, fontSize:22, fontWeight:600, width:36, color: T.ink, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{String(race.wk).padStart(2,'0')}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1.1, color: isNow ? T.hot : T.ink }}>
                    {race.raceName || race.track}
                  </div>
                  {race.raceName && <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.ink2, marginTop:3 }}>
                    {race.track}
                  </div>}
                </div>
                <TrackShape track={race.track} size={42} color={isNow ? T.hot : T.ink2} stroke={2.2}/>
              </div>
              <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute, marginTop:race.raceName ? 4 : 3 }}>
                {race.type} · {race.len} mi · {race.laps} laps
              </div>
              {hasBonus && <div style={{
                marginTop:6, display:'inline-flex', alignItems:'center', gap:4,
                padding:'2px 8px', background: T.hot, color:'#fff',
                borderRadius:2,
                fontFamily: FL, fontSize:9, fontWeight:700,
                letterSpacing:'0.2em', textTransform:'uppercase',
              }}>+ {cfg.bonusSeries.map(s => SERIES[s]?.short || s).join(' · ')}</div>}
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
