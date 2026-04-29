'use client';
import React from 'react';
import { BackChip, PlayerBadge, SectionLabel, TopBar, WinsCount } from '@/components/ui/primitives';
import { FB, FD, FI, FL, T } from '@/lib/constants';
import { computeStandings } from '@/lib/utils';

export default function StandingsScreen({ state, onNav }) {
  const { players, weeklyResults, currentWeek } = state;
  const standings = computeStandings(players, weeklyResults, currentWeek - 1);
  const sorted = [...standings].sort((a,b) => b.seasonPts - a.seasonPts);
  const max = Math.max(1, ...sorted.map(s => s.seasonPts));
  const completedWeeks = weeklyResults.slice().sort((a,b) => a.wk - b.wk);

  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle={`Through Week ${String(currentWeek - 1).padStart(2,'0')}`} title="Standings" right={<BackChip onClick={() => onNav('home')}/>}/>

    <div style={{ padding:'0 20px 20px' }}>
      <div style={{ background: T.ink, color: T.bg, borderRadius:4, padding:'22px 20px' }}>
        {completedWeeks.length === 0 ? <>
          <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.24em', textTransform:'uppercase', color:'rgba(247,244,237,0.4)' }}>Season opener</div>
          <div style={{ fontFamily: FD, fontSize:36, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1.05, marginTop:6 }}>
            All tied at 0 — let the season begin.
          </div>
          <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:14, color:'rgba(247,244,237,0.6)', marginTop:10, lineHeight:1.5 }}>
            Standings will populate once the first race is in the books. Slot picks for Week 1 are alphabetical.
          </div>
        </> : <>
          <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.24em', textTransform:'uppercase', color:'rgba(247,244,237,0.4)' }}>Current Leader</div>
          <div style={{ fontFamily: FD, fontSize:48, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1, marginTop:6 }}>{sorted[0].name}</div>
          <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:14, color:'rgba(247,244,237,0.6)', marginTop:8 }}>
            {sorted[0].seasonPts.toLocaleString()} pts{sorted[1] ? ` · +${sorted[0].seasonPts - sorted[1].seasonPts} over ${sorted[1].name}` : ''}
          </div>
        </>}
      </div>
    </div>

    <SectionLabel>Season Ranking</SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      {sorted.map((p, i) => {
        const gap = i === 0 ? 0 : sorted[0].seasonPts - p.seasonPts;
        return <div key={p.id} style={{
          padding:'14px 0',
          borderBottom: i === sorted.length-1 ? 'none' : `0.5px solid ${T.line2}`,
          display:'flex', alignItems:'center', gap:14,
        }}>
          <div style={{ fontFamily: FD, fontSize:20, fontWeight:600, width:26, color: T.ink, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{String(i+1).padStart(2,'0')}</div>
          <PlayerBadge player={p} size={26}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <span style={{ fontFamily: FD, fontSize:20, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1 }}>{p.name}</span>
              <WinsCount wins={p.wins}/>
            </div>
            <div style={{ marginTop:6, height:2, background: T.bg2, borderRadius:0 }}>
              <div style={{ width: `${(p.seasonPts / max) * 100}%`, height:'100%', background: i === 0 ? T.hot : T.ink2 }}/>
            </div>
          </div>
          <div style={{ textAlign:'right', minWidth:78 }}>
            <div style={{ fontFamily: FB, fontSize:15, fontWeight:500, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.01em' }}>{p.seasonPts.toLocaleString()}</div>
            <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, color: T.mute, marginTop:1, fontVariantNumeric:'tabular-nums' }}>
              {i === 0
                ? (p.avgPts ? `avg ${p.avgPts}` : 'Leader')
                : `−${gap.toLocaleString()} back${p.avgPts ? ` · avg ${p.avgPts}` : ''}`}
            </div>
          </div>
        </div>;
      })}
    </div>

    {completedWeeks.length > 0 && <>
      <SectionLabel right={<span style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, textTransform:'none', letterSpacing:'0.01em', color: T.mute }}>Scroll →</span>}>By Week</SectionLabel>
      <div style={{ padding:'14px 20px 20px' }}>
        <div style={{
          borderTop:`0.5px solid ${T.line}`, borderBottom:`0.5px solid ${T.line}`,
          overflowX:'auto', overflowY:'hidden',
        }}>
          <div style={{
            display:'grid',
            gridTemplateColumns:`72px repeat(${completedWeeks.length}, 38px) 56px`,
            padding:'8px 0', borderBottom:`0.5px solid ${T.line2}`,
            background: T.bg, position:'sticky', top:0,
          }}>
            <div style={{
              padding:'0 6px', fontFamily: FL, fontSize:9, fontWeight:600,
              letterSpacing:'0.22em', textTransform:'uppercase', color: T.mute,
              position:'sticky', left:0, background: T.bg,
            }}>Player</div>
            {completedWeeks.map(w => (
              <div key={w.wk} style={{
                textAlign:'center', fontFamily: FB, fontSize:11, fontWeight:600,
                color: T.mute, fontVariantNumeric:'tabular-nums',
              }}>{String(w.wk).padStart(2,'0')}</div>
            ))}
            <div style={{
              textAlign:'right', paddingRight:6, fontFamily: FL, fontSize:9, fontWeight:600,
              letterSpacing:'0.22em', textTransform:'uppercase', color: T.hot,
            }}>Total</div>
          </div>
          {sorted.map((p, pi) => (
            <div key={p.id} style={{
              display:'grid',
              gridTemplateColumns:`72px repeat(${completedWeeks.length}, 38px) 56px`,
              alignItems:'center',
              borderBottom: pi === sorted.length-1 ? 'none' : `0.5px solid ${T.line2}`,
            }}>
              <div style={{
                padding:'10px 6px', display:'flex', alignItems:'center', gap:6,
                position:'sticky', left:0, background: T.bg,
              }}>
                <PlayerBadge player={p} size={18}/>
                <span style={{ fontFamily: FD, fontSize:14, fontWeight:600, letterSpacing:'-0.03em' }}>{p.name.slice(0,4)}</span>
              </div>
              {completedWeeks.map(w => {
                const wpts = Object.values(w.pts);
                const wkMax = Math.max(...wpts);
                const mypts = w.pts[p.id] || 0;
                const isTop = mypts === wkMax && wpts.length > 0;
                return <div key={w.wk} style={{
                  textAlign:'center', padding:'10px 0',
                  fontFamily: FB, fontSize:12, fontWeight: isTop ? 600 : 400,
                  color: isTop ? T.hot : T.ink2,
                  fontVariantNumeric:'tabular-nums',
                }}>{mypts}</div>;
              })}
              <div style={{
                textAlign:'right', paddingRight:6,
                fontFamily: FB, fontSize:13, fontWeight:600,
                color: T.ink, fontVariantNumeric:'tabular-nums',
              }}>{p.seasonPts.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </>}
  </div>;
}
