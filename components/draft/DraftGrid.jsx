'use client';
import React from 'react';
import { CarNum, SectionLabel } from '@/components/ui/primitives';
import { FB, FD, FI, FL, SERIES, T } from '@/lib/constants';
import { pickKey } from './pickKey';

// Driver-pool grid. The main "make a pick" UI for the active series.
//
// Props are grouped for clarity (was 13 positional props):
//   pool      — what to render and how to label it
//   draft     — current draft state needed to flag taken cards
//   handlers  — interaction callbacks
//
// pool: {
//   drivers       — the active series' driver list
//   activeSeries  — id ('Cup' | 'Truck' | ...)
//   driverStats   — Map<driverNum, statRow> for Cup stat blocks
//   freshPickKeys — Set of "series:num" keys that just landed (anim trigger)
//   remaining     — picks remaining for the current picker in this series
//   isEmpty       — true when the pool has no drivers (admin must populate)
//   isAdmin       — gates the "Manage Drivers →" CTA in the empty state
// }
// draft: {
//   pickedKeys    — Set of "series:num" keys already taken (any series)
//   picks         — full picks array (for resolving owner per card)
//   players       — full players list (for resolving owner badge name)
// }
// handlers: { onPick, onAddDriver, onNav }
export function DraftGrid({ pool, draft, handlers }) {
  const { drivers, activeSeries, driverStats, freshPickKeys, remaining, isEmpty, isAdmin } = pool;
  const { pickedKeys, picks, players } = draft;
  const { onPick, onAddDriver, onNav } = handlers;

  if (isEmpty) {
    const meta = SERIES[activeSeries] || { label: activeSeries };
    return <div style={{ padding:'24px 20px' }}>
      <div style={{
        background: T.card, border:`1px solid ${T.line}`, borderRadius:6,
        padding:'28px 22px', textAlign:'center',
      }}>
        <div style={{ fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.22em', textTransform:'uppercase', color: T.hot }}>{meta.label}</div>
        <div style={{ fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.02em', marginTop:8, lineHeight:1.3 }}>
          No drivers added yet
        </div>
        <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:13, color: T.mute, marginTop:8, lineHeight:1.5 }}>
          {isAdmin
            ? `Add ${meta.label} drivers in Manage Drivers before the league can pick from this series.`
            : `Waiting on the commissioner to add ${meta.label} drivers.`}
        </div>
        {isAdmin && <button onClick={onAddDriver} style={{
          appearance:'none', marginTop:14,
          background: T.ink, color: T.bg, border:'none', borderRadius:3,
          padding:'10px 18px', cursor:'pointer',
          fontFamily: FL, fontSize:10, fontWeight:600, letterSpacing:'0.22em', textTransform:'uppercase',
        }}>Manage Drivers →</button>}
      </div>
    </div>;
  }
  return <div>
    <div style={{ height:14 }}/>
    <SectionLabel right={<span style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, textTransform:'none', letterSpacing:'0.01em', color: T.ink }}>{remaining} left from this series · {drivers.filter(d => !pickedKeys.has(pickKey(activeSeries, d.num))).length} available</span>}>
      {(SERIES[activeSeries]?.label || activeSeries)} · Tap to Pick
    </SectionLabel>
    <div style={{ padding:'12px 20px 16px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
        {drivers.map(d => {
          const taken = pickedKeys.has(pickKey(activeSeries, d.num));
          const takenBy = taken ? picks.find(p => p.driverNum === d.num && (p.series || 'Cup') === activeSeries) : null;
          const takenPl = takenBy ? players.find(p => p.id === takenBy.playerId) : null;
          const isFresh = taken && freshPickKeys?.has(pickKey(activeSeries, d.num));
          // Stats only meaningful for Cup picks (bonus pools are one-offs).
          // We hide stats on already-taken cards because the card is muted
          // and the user can't pick them anyway — keeping them readable
          // would just compete with the "TONE" owner tag.
          const stats = (!taken && activeSeries === 'Cup') ? driverStats?.get(d.num) : null;
          return <button key={d.num} onClick={() => !taken && onPick(d)} disabled={taken} style={{
            appearance:'none',
            position:'relative', overflow:'hidden',
            background: taken
              ? 'linear-gradient(180deg, rgba(20,17,13,0.04) 0%, rgba(20,17,13,0.08) 100%)'
              : `linear-gradient(180deg, ${T.card} 0%, #F5F1E5 100%)`,
            border: `1px solid ${taken ? 'rgba(20,17,13,0.08)' : 'rgba(184,147,90,0.22)'}`,
            borderRadius:10,
            padding:'12px 8px 10px', cursor: taken ? 'default' : 'pointer',
            opacity: taken ? 0.45 : 1,
            filter: taken ? 'grayscale(0.85)' : 'none',
            display:'flex', flexDirection:'column', alignItems:'center', gap:9,
            boxShadow: taken
              ? 'none'
              : 'inset 0 1px 0 rgba(255,255,255,0.85), 0 2px 6px rgba(20,17,13,0.06), 0 8px 18px rgba(20,17,13,0.05)',
            transition:'transform .12s ease',
            // Pulse a copper ring around the card the instant it becomes
            // taken — gives the league a peripheral cue when someone else's
            // pick lands during shared drafting. Forwards fill so the
            // shadow doesn't reset visibly when the animation ends.
            animation: isFresh ? 'hm-pickring 900ms ease-out forwards' : 'none',
          }}>
            {!taken && <div style={{
              position:'absolute', top:0, left:0, right:0, height:3,
              background: `linear-gradient(90deg, ${d.primary} 0%, ${d.primary} 60%, ${d.secondary || d.primary} 100%)`,
            }}/>}
            {!taken && <div style={{
              position:'absolute', top:0, left:0, right:0, height:'42%',
              background:'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 100%)',
              pointerEvents:'none',
            }}/>}
            {taken && takenPl && <div style={{
              position:'absolute', top:0, right:0,
              background: takenPl.color, color:'#fff',
              padding:'3px 7px',
              fontFamily: FL, fontWeight:700, fontSize:8,
              letterSpacing:'0.18em', textTransform:'uppercase',
              borderBottomLeftRadius:6,
              // The tag slides in from the right edge on first appearance.
              // After the 400ms run completes it stays in place.
              animation: isFresh ? 'hm-tagslide 400ms cubic-bezier(0.32,0.72,0,1) both' : 'none',
            }}>{takenPl.name.slice(0,3)}</div>}
            {/* Outer card is a <button> for picking; CarNum's onClick form
                would render button-in-button. Wrap the chip in a non-tabbable
                span so the stats tap target stays valid HTML. */}
            {activeSeries === 'Cup' ? (
              <span
                onClick={(e) => { e.stopPropagation(); onNav('drivers', { driverNum: d.num }); }}
                style={{ display:'inline-flex', cursor:'pointer' }}
              ><CarNum driver={d} size={48}/></span>
            ) : (
              <CarNum driver={d} size={48}/>
            )}
            <div style={{
              fontFamily: FD, fontSize:13, fontWeight:600,
              lineHeight:1.1, letterSpacing:'-0.02em',
              textDecoration: taken ? 'line-through' : 'none',
              color: T.ink, textAlign:'center',
              wordBreak:'break-word',
              position:'relative', zIndex:1,
            }}>{d.name}</div>
            {/* Stat block — small, muted, two lines max. The headline is the
                season avg per draft because that's the single most useful
                "should I pick this driver" number. Recent form (L3) goes
                below as comma-separated points. Drivers never picked show
                a "first draft" note instead so the card doesn't feel hollow.
                Bonus-series picks have no stats — pool is per-week. */}
            {stats && stats.totalPicks > 0 && <div style={{
              position:'relative', zIndex:1,
              display:'flex', flexDirection:'column', alignItems:'center', gap:1,
              marginTop:-2,
            }}>
              <div style={{
                fontFamily: FB, fontSize:11, fontWeight:600,
                color: T.ink2, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.01em',
              }}>
                <span>{stats.avgPts}</span>
                <span style={{ color: T.mute, fontWeight:500 }}> avg</span>
                <span style={{ color: T.mute, fontWeight:500 }}> · {stats.totalPicks}×</span>
              </div>
              {stats.weeks.length > 0 && <div style={{
                fontFamily: FB, fontSize:9, color: T.mute,
                fontVariantNumeric:'tabular-nums', letterSpacing:'0.02em',
              }}>
                L{Math.min(3, stats.weeks.length)}{' '}
                {stats.weeks.slice(-3).map(w => w.pts).join(' · ')}
              </div>}
            </div>}
            {!taken && activeSeries === 'Cup' && (!stats || stats.totalPicks === 0) && <div style={{
              position:'relative', zIndex:1,
              fontFamily: FI, fontStyle:'italic', fontSize:10, color: T.mute,
              marginTop:-2,
            }}>First draft</div>}
          </button>;
        })}
      </div>
    </div>
  </div>;
}
