'use client';
import React, { useMemo, useState } from 'react';
import { BackChip, CarNum, DriverRow, SectionLabel, TopBar } from '@/components/ui/primitives';
import { FB, FD, FI, FL, SERIES, T } from '@/lib/constants';
import { DEFAULT_DRIVERS } from '@/lib/data';
import { getBonusPool, getWeekConfig, makeDriverWeekData } from '@/lib/utils';

// Pull a driver definition for any pick (Cup or bonus). Falls back to a stub
// if the pool entry was later removed by the admin so historical rosters
// always render something rather than silently dropping picks.
function resolveDriver(state, wk, pk) {
  const series = pk.series || 'Cup';
  if (series === 'Cup') {
    const wkExtras = (state.weekDriversExtra || {})[wk] || [];
    const cup = [...DEFAULT_DRIVERS, ...wkExtras];
    return cup.find(d => d.num === pk.driverNum) || stub(pk);
  }
  return getBonusPool(state, wk, series).find(d => d.num === pk.driverNum) || stub(pk);
}
function stub(pk) {
  return {
    num: pk.driverNum, name: pk.driverName || `#${pk.driverNum}`,
    primary: '#7A7268', secondary: '#3D3934', team: '—',
  };
}

function SeriesTag({ series }) {
  if (!series || series === 'Cup') return null;
  const meta = SERIES[series] || { short: series.slice(0,3).toUpperCase() };
  return <span style={{
    display:'inline-block', padding:'1px 4px', borderRadius:2,
    background: T.hot, color:'#fff',
    fontFamily: FL, fontSize:7, fontWeight:700,
    letterSpacing:'0.16em', textTransform:'uppercase',
    verticalAlign:'middle', marginLeft:3,
  }}>{meta.short}</span>;
}

export default function TeamScreen({ state, me, onNav }) {
  const { currentWeek, draftState, draftHistory = [], weeklyResults = [] } = state;
  const cfg = getWeekConfig(state, currentWeek);

  // Current-week roster — group picks by series so bonus drivers render in
  // their own labeled sections rather than mingled with the Cup picks.
  const myPicks = (draftState?.picks || []).filter(p => p.playerId === me.id);
  const myCupDrivers = useMemo(() => {
    const wkExtras = (state.weekDriversExtra || {})[currentWeek] || [];
    const pool = [...DEFAULT_DRIVERS, ...wkExtras];
    return makeDriverWeekData(pool, currentWeek * 100 + pool.length);
  }, [state.weekDriversExtra, currentWeek]);

  const myPicksBySeries = {};
  myPicks.forEach(pk => {
    const series = pk.series || 'Cup';
    if (!myPicksBySeries[series]) myPicksBySeries[series] = [];
    if (series === 'Cup') {
      const d = myCupDrivers.find(x => x.num === pk.driverNum);
      if (d) myPicksBySeries[series].push(d);
    } else {
      const d = resolveDriver(state, currentWeek, pk);
      myPicksBySeries[series].push(d);
    }
  });

  const totalPicked = myPicks.length;
  const seriesRenderOrder = Object.keys(cfg.allotments).filter(s => myPicksBySeries[s]?.length);

  // Past weeks roster history (collapsible).
  const pastRosters = draftHistory
    .filter(h => h.wk < currentWeek)
    .sort((a, b) => b.wk - a.wk)
    .map(h => ({
      wk: h.wk,
      track: h.track,
      picks: h.picks.filter(p => p.playerId === me.id),
    }));

  const [expanded, setExpanded] = useState(null);

  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle={`${me.name} · Week ${String(currentWeek).padStart(2,'0')}`} title="My Team" right={<BackChip onClick={() => onNav('home')}/>}/>

    <SectionLabel right={cfg.bonusSeries.length > 0
      ? <span style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, textTransform:'none', letterSpacing:'0.01em', color: T.mute }}>{totalPicked}/{cfg.totalPicks}</span>
      : null
    }>This Week's Roster</SectionLabel>

    <div style={{ padding:'14px 20px 20px' }}>
      {totalPicked === 0 ? (
        <div style={{ padding:'28px 20px', textAlign:'center', borderTop:`1px solid ${T.line}`, borderBottom:`1px solid ${T.line}` }}>
          <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:15, color: T.mute, lineHeight:1.5 }}>
            {(draftState?.phase === 'done')
              ? `No picks this week — looks like you sat out Wk ${String(currentWeek).padStart(2,'0')}.`
              : `The Wk ${String(currentWeek).padStart(2,'0')} draft is still going. Lock in your ${cfg.totalPicks} drivers.`}
          </div>
          <button onClick={() => onNav('draft')} style={{
            appearance:'none', marginTop:14,
            background: T.ink, color: T.bg,
            border:'none', padding:'10px 18px', borderRadius:3, cursor:'pointer',
            fontFamily: FL, fontSize:10, fontWeight:600,
            letterSpacing:'0.2em', textTransform:'uppercase',
          }}>Go to Draft →</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {seriesRenderOrder.map(series => {
            const list = myPicksBySeries[series];
            const meta = SERIES[series] || { label: series };
            return <div key={series}>
              {(series !== 'Cup' || cfg.bonusSeries.length > 0) && <div style={{
                fontFamily: FL, fontSize:9, fontWeight:600,
                letterSpacing:'0.22em', textTransform:'uppercase',
                color: series === 'Cup' ? T.mute : T.hot,
                marginBottom:6,
              }}>{meta.label}</div>}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {list.map(d => <DriverRow key={`${series}:${d.num}`} driver={d}/>)}
              </div>
            </div>;
          })}
        </div>
      )}
    </div>

    {pastRosters.length > 0 && <>
      <SectionLabel right={<span style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, textTransform:'none', letterSpacing:'0.01em', color: T.mute }}>{pastRosters.length} week{pastRosters.length === 1 ? '' : 's'} · tap to expand</span>}>Past Rosters</SectionLabel>
      <div style={{ padding:'14px 20px 20px' }}>
        {pastRosters.map((r, idx) => {
          const wkResult = weeklyResults.find(w => w.wk === r.wk);
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
              {r.picks.map((pk, pi) => {
                const d = resolveDriver(state, r.wk, pk);
                const series = pk.series || 'Cup';
                return <div key={`${series}:${pk.driverNum}:${pi}`} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background: T.card, border:`0.5px solid ${T.line2}`, borderRadius:4 }}>
                  <CarNum driver={d} size={28}/>
                  <span style={{ fontFamily: FD, fontSize:13, fontWeight:600, letterSpacing:'-0.02em' }}>{d.name}</span>
                  <SeriesTag series={series}/>
                </div>;
              })}
            </div>}
          </div>;
        })}
      </div>
    </>}
  </div>;
}
