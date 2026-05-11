'use client';
import React, { useState } from 'react';
import { BackChip, CarNum, PlayerBadge, RaceCountdown, SectionLabel, TopBar } from '@/components/ui/primitives';
import { FB, FD, FI, FL, SERIES, T } from '@/lib/constants';
import { getWeekConfig } from '@/lib/utils';

// Track type → visual treatment. Color-coded glyph at the start of each
// schedule row, plus the same color used in the detail-page hero accent.
// Keeping the palette muted so it never competes with the copper accent
// system used elsewhere in the app.
const TRACK_TYPE_META = {
  'Superspeedway': { tag: 'SS', color: '#9C4A2F', label: 'Superspeedway' },
  'Intermediate':  { tag: 'IM', color: '#B8935A', label: 'Intermediate'  },
  'Short Oval':    { tag: 'SH', color: '#5A7A5E', label: 'Short Oval'    },
  'Road Course':   { tag: 'RC', color: '#3D6B6B', label: 'Road Course'   },
  'Street':        { tag: 'ST', color: '#6B4A5E', label: 'Street'        },
};
function trackTypeMeta(t) {
  return TRACK_TYPE_META[t] || { tag: '—', color: T.mute, label: t || 'Track' };
}

function TrackTypeBadge({ type, size = 28 }) {
  const meta = trackTypeMeta(type);
  return <div title={meta.label} style={{
    width: size, height: size, borderRadius:'50%',
    background: meta.color, color:'#fff',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontFamily: FL, fontSize: size * 0.36, fontWeight:700,
    letterSpacing:'0.04em',
    flexShrink:0,
    boxShadow:'inset 0 1px 0 rgba(255,255,255,0.18)',
  }}>{meta.tag}</div>;
}

// Filter chip strip — All | Upcoming | Bonus. Selecting "Upcoming" hides
// races whose week is in the past (currentWeek - 1 or earlier). "Bonus"
// shows only weeks with a non-Cup allotment configured. The active chip
// gets the dark/cream pairing; inactive chips read as outlined.
const FILTERS = [
  { id: 'all',      label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'bonus',    label: 'Bonus' },
];

export default function ScheduleScreen({ state, onBack, onNav }) {
  const { schedule, currentWeek } = state;
  const [openWk, setOpenWk] = useState(null);
  const [filter, setFilter] = useState('all');

  // Detail mode — render the per-race detail in place of the list.
  if (openWk != null) {
    const race = schedule.find(r => r.wk === openWk);
    if (race) {
      return <RaceDetail race={race} state={state} onBack={() => setOpenWk(null)} onNav={onNav}/>;
    }
  }

  // Apply the filter. We always include the current week regardless so the
  // user never loses sight of "what's right now."
  const filtered = schedule.filter(race => {
    if (filter === 'all') return true;
    if (race.wk === currentWeek) return true;
    if (filter === 'upcoming') return race.wk >= currentWeek;
    if (filter === 'bonus') return getWeekConfig(state, race.wk).bonusSeries.length > 0;
    return true;
  });

  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle="Season 2026" title="Schedule" right={<BackChip onClick={onBack}/>}/>

    {/* Filter chips */}
    <div style={{ padding:'0 20px 4px' }}>
      <div style={{ display:'flex', gap:6 }}>
        {FILTERS.map(f => {
          const active = filter === f.id;
          return <button key={f.id} onClick={() => setFilter(f.id)} style={{
            appearance:'none', flex:1,
            padding:'9px 10px',
            background: active ? T.ink : T.card,
            color: active ? T.bg : T.ink,
            border:`1px solid ${active ? T.ink : T.line}`,
            borderRadius:3,
            cursor:'pointer',
            fontFamily: FL, fontSize:10, fontWeight:600,
            letterSpacing:'0.22em', textTransform:'uppercase',
          }}>{f.label}</button>;
        })}
      </div>
    </div>

    <div style={{ padding:'14px 20px 20px' }}>
      {filtered.length === 0 ? <div style={{
        padding:'30px 10px', textAlign:'center',
        fontFamily: FI, fontStyle:'italic', fontSize:14, color: T.mute, lineHeight:1.5,
      }}>
        No races match this filter.
      </div> : filtered.map((race, idx) => {
        const isNow = race.wk === currentWeek;
        const isPast = race.wk < currentWeek;
        const cfg = getWeekConfig(state, race.wk);
        const hasBonus = cfg.bonusSeries.length > 0;
        return <button key={race.wk} onClick={() => setOpenWk(race.wk)} style={{
          appearance:'none', background:'transparent', border:'none',
          padding:'14px 0',
          width:'100%', textAlign:'left', cursor:'pointer',
          borderBottom: idx === filtered.length-1 ? 'none' : `0.5px solid ${T.line2}`,
          opacity: isPast ? 0.55 : 1,
          display:'flex', alignItems:'flex-start', gap:14,
        }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, width:36, flexShrink:0 }}>
            <div style={{ fontFamily: FD, fontSize:22, fontWeight:600, color: T.ink, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{String(race.wk).padStart(2,'0')}</div>
            <TrackTypeBadge type={race.type} size={22}/>
          </div>
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
          <div style={{ textAlign:'right', flexShrink:0, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
            <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.2em', textTransform:'uppercase', color: isNow ? T.hot : isPast ? T.mute : T.ink2 }}>{isNow ? 'Current' : isPast ? 'Final' : 'Upcoming'}</div>
            <div style={{ color: T.mute, fontFamily: FI, fontStyle:'italic', fontSize:14 }}>›</div>
          </div>
        </button>;
      })}
    </div>
  </div>;
}

// ── Per-race detail ────────────────────────────────────────────────
// Three sections, all conditional on having data:
//   1. Hero card (always) — race name, track, type/len/laps, countdown
//   2. Bonus pool preview (if any bonus series this week) — chips for each
//      driver in each pool, taken from state.bonusDriversByWeek[wk][series]
//   3. League history at this track — every prior weeklyResults row whose
//      track string matches, showing the winner + their points. We match by
//      `track` (not raceName) so spring/fall variants of the same speedway
//      collapse into one history view.
function RaceDetail({ race, state, onBack, onNav }) {
  const { weeklyResults = [], players, schedule, currentWeek } = state;
  const cfg = getWeekConfig(state, race.wk);
  const hasBonus = cfg.bonusSeries.length > 0;
  const bonusPools = state.bonusDriversByWeek?.[race.wk] || {};
  const typeMeta = trackTypeMeta(race.type);

  const isPast = race.wk < currentWeek;
  const isNow = race.wk === currentWeek;
  const status = isNow ? 'Current' : isPast ? 'Final' : 'Upcoming';

  // History at this track — match by track string. Excludes the current
  // race's own row even if it's already finalized (it'll show as Final
  // Result up top instead). Sorted newest-first so this season's prior
  // visit (if any) is the first thing the league sees.
  const trackHistory = weeklyResults
    .filter(w => w.wk !== race.wk && w.track === race.track)
    .sort((a, b) => b.wk - a.wk)
    .map(w => {
      const top = Object.entries(w.pts).reduce((m, [pid, v]) => (!m || v > m[1]) ? [pid, v] : m, null);
      const winner = top ? players.find(p => p.id === top[0]) : null;
      const meta = schedule.find(s => s.wk === w.wk);
      return { wk: w.wk, track: w.track, winnerName: winner?.name, winnerColor: winner?.color, winnerInitial: winner?.initial, pts: top?.[1], raceName: meta?.raceName };
    });

  // This race's own result if it's already final (admin entered points
  // and advanced). Different shape from trackHistory because it's the
  // headline result for this very page rather than a "prior visits" row.
  const thisResult = weeklyResults.find(w => w.wk === race.wk && w.finalized);
  const thisTop = thisResult
    ? (() => {
        const t = Object.entries(thisResult.pts).reduce((m, [pid, v]) => (!m || v > m[1]) ? [pid, v] : m, null);
        if (!t) return null;
        const p = players.find(pl => pl.id === t[0]);
        return p ? { player: p, pts: t[1] } : null;
      })()
    : null;

  return <div style={{ paddingBottom:24 }}>
    <TopBar
      subtitle={`Wk ${String(race.wk).padStart(2,'0')} · ${status}`}
      title={race.raceName || race.track}
      right={<BackChip onClick={onBack} label="Schedule"/>}
    />

    {/* Hero */}
    <div style={{ padding:'0 20px 18px' }}>
      <div style={{ background: T.ink, color: T.bg, borderRadius:4, padding:'22px 20px', position:'relative', overflow:'hidden' }}>
        {/* Track-type accent stripe along the top edge — quick visual cue
            tying the detail back to the badge on the list row. */}
        <div style={{
          position:'absolute', top:0, left:0, right:0, height:3,
          background: typeMeta.color,
        }}/>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <TrackTypeBadge type={race.type} size={28}/>
          <div style={{ fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.24em', textTransform:'uppercase', color:'rgba(247,244,237,0.5)' }}>{typeMeta.label}</div>
        </div>
        <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.24em', textTransform:'uppercase', color:'rgba(247,244,237,0.4)', marginTop:14 }}>{race.track}</div>
        <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:14, color:'rgba(247,244,237,0.7)', marginTop:8 }}>
          {race.len} mi · {race.laps} laps
        </div>
        {(race.time || race.network) && <div style={{ marginTop:14 }}>
          <RaceCountdown date={race.date} time={race.time} network={race.network} tone="dark"/>
        </div>}
        {race.lastWinner && <div style={{
          marginTop:14, paddingTop:12,
          borderTop:'0.5px solid rgba(247,244,237,0.08)',
          fontFamily: FL, fontSize:9, fontWeight:500,
          letterSpacing:'0.22em', textTransform:'uppercase',
          color:'rgba(247,244,237,0.4)',
        }}>
          2025 Winner · <span style={{ fontFamily: FB, fontSize:12, fontWeight:600, letterSpacing:'-0.005em', textTransform:'none', color:'rgba(247,244,237,0.85)' }}>{race.lastWinner}</span>
        </div>}
      </div>
    </div>

    {/* This race's own result if final */}
    {thisTop && <>
      <SectionLabel>League Result</SectionLabel>
      <div style={{ padding:'14px 20px 18px' }}>
        <div style={{
          background: T.card, border:`1px solid ${T.line2}`, borderRadius:6,
          padding:'14px 16px',
          display:'flex', alignItems:'center', gap:14,
        }}>
          <PlayerBadge player={thisTop.player} size={36}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.24em', textTransform:'uppercase', color: T.hot }}>League Winner</div>
            <div style={{ fontFamily: FD, fontSize:20, fontWeight:600, letterSpacing:'-0.03em', marginTop:2 }}>{thisTop.player.name}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily: FB, fontSize:22, fontWeight:600, fontVariantNumeric:'tabular-nums', color: T.hot }}>{thisTop.pts}</div>
            <div style={{ fontFamily: FL, fontSize:8, color: T.mute, letterSpacing:'0.22em', textTransform:'uppercase' }}>pts</div>
          </div>
        </div>
      </div>
    </>}

    {/* Bonus pool preview — only meaningful before a bonus week starts.
        If pools are still empty (admin hasn't populated them yet), show a
        gentle empty-state instead of pretending there's nothing planned. */}
    {hasBonus && <>
      <SectionLabel right={<span style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, textTransform:'none', letterSpacing:'0.01em', color: T.mute }}>{cfg.totalPicks} picks/player</span>}>Bonus Week</SectionLabel>
      <div style={{ padding:'14px 20px 20px', display:'flex', flexDirection:'column', gap:12 }}>
        {Object.entries(cfg.allotments).map(([series, count]) => {
          const meta = SERIES[series] || { label: series };
          if (series === 'Cup') return null;
          const pool = bonusPools[series] || [];
          return <div key={series} style={{
            background: T.card, border:`1px solid ${T.line2}`, borderRadius:6,
            padding:'12px 14px',
          }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
              <div style={{ fontFamily: FL, fontSize:10, fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', color: T.hot }}>{meta.label}</div>
              <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute }}>{count}/player · {pool.length} in pool</div>
            </div>
            {pool.length > 0 ? <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:8 }}>
              {pool.map(d => <CarNum key={d.num} driver={d} size={26} onClick={series === 'Cup' ? () => onNav('drivers', { driverNum: d.num }) : undefined}/>)}
            </div> : <div style={{
              fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute, marginTop:6,
            }}>Admin hasn't built this pool yet.</div>}
          </div>;
        })}
      </div>
    </>}

    {/* League history at this track */}
    {trackHistory.length > 0 && <>
      <SectionLabel right={<span style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, textTransform:'none', letterSpacing:'0.01em', color: T.mute }}>{trackHistory.length} prior visit{trackHistory.length === 1 ? '' : 's'}</span>}>League History at {race.track}</SectionLabel>
      <div style={{ padding:'14px 20px 20px' }}>
        {trackHistory.map((h, i) => <div key={h.wk} style={{
          padding:'12px 0',
          borderBottom: i === trackHistory.length-1 ? 'none' : `0.5px solid ${T.line2}`,
          display:'flex', alignItems:'center', gap:12,
        }}>
          <div style={{ fontFamily: FL, fontSize:10, fontWeight:500, letterSpacing:'0.2em', textTransform:'uppercase', color: T.mute, width:42 }}>Wk {String(h.wk).padStart(2,'0')}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily: FD, fontSize:14, fontWeight:600, letterSpacing:'-0.02em', lineHeight:1.1 }}>
              {h.raceName || h.track}
            </div>
            {h.winnerName && <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:3 }}>
              <PlayerBadge player={{ name: h.winnerName, color: h.winnerColor || T.mute, initial: h.winnerInitial || h.winnerName[0] }} size={14}/>
              <span style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, color: T.mute }}>{h.winnerName} took it</span>
            </div>}
          </div>
          <div style={{ fontFamily: FB, fontSize:14, fontWeight:600, color: T.hot, fontVariantNumeric:'tabular-nums' }}>{h.pts ?? '—'}</div>
        </div>)}
      </div>
    </>}

    {/* Empty state if no extra info to show beyond the hero — at least
        the user gets a clear "nothing more to see here yet" rather than
        an awkwardly short page. */}
    {!thisTop && !hasBonus && trackHistory.length === 0 && <div style={{
      padding:'8px 28px 20px', textAlign:'center',
      fontFamily: FI, fontStyle:'italic', fontSize:13, color: T.mute, lineHeight:1.5,
    }}>
      No prior league history at {race.track}. The detail will fill in as the season progresses.
    </div>}
  </div>;
}
