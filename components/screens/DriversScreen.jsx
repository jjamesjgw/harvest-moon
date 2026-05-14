'use client';
import React, { useEffect, useState } from 'react';
import { BackChip, CarNum, PlayerBadge, SectionLabel, TopBar } from '@/components/ui/primitives';
import { FB, FD, FI, FL, FM, T } from '@/lib/constants';

// Sort options for the leaderboard. Each option declares:
//   id    — unique key, used in segmented control state
//   label — short label shown in the chip
//   key   — primary stat shown in the right column for each row
//   sort  — comparator function (b - a, descending)
//   fmt   — formatter for the displayed value
const SORTS = [
  { id: 'total', label: 'Total',    key: 'totalPts',   sort: (a,b) => b.totalPts - a.totalPts,     fmt: r => r.totalPts },
  { id: 'avg',   label: 'Avg',      key: 'avgPts',     sort: (a,b) => b.avgPts - a.avgPts,         fmt: r => r.avgPts },
  { id: 'picks', label: 'Picks',    key: 'totalPicks', sort: (a,b) => b.totalPicks - a.totalPicks, fmt: r => r.totalPicks },
  { id: 'best',  label: 'Best Wk',  key: 'bestWeekPts', sort: (a,b) => (b.bestWeek?.pts||0) - (a.bestWeek?.pts||0), fmt: r => r.bestWeek?.pts || 0 },
];

export default function DriversScreen({ state, me, onBack, initialNum, onConsumeInitial, driverStats }) {
  const all = driverStats;
  const [scope, setScope] = useState('league'); // 'league' | 'mine'
  const [sortId, setSortId] = useState('total');
  const [openNum, setOpenNum] = useState(initialNum ?? null); // when set, render detail view

  // Honor a deep-link from elsewhere in the app: if we mounted with an
  // initialNum (because a CarNum chip was tapped on Recap, Team, etc.),
  // open that driver's detail view and clear the pending value so a
  // subsequent navigation away and back doesn't re-open the same driver.
  useEffect(() => {
    if (initialNum != null) {
      setOpenNum(initialNum);
      onConsumeInitial?.();
    }
    // We only consume on mount; later changes to initialNum from the parent
    // would be unusual but we still want to honor them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNum]);

  // Filter drivers by scope. "Mine" = drivers I've personally drafted at any point.
  const myIds = new Set(
    all.drivers
      .filter(d => d.byPlayer.some(b => b.playerId === me?.id))
      .map(d => d.num)
  );
  const scoped = scope === 'mine'
    ? all.drivers.filter(d => myIds.has(d.num))
    : all.drivers;

  const sortFn = SORTS.find(s => s.id === sortId) || SORTS[0];
  const sorted = [...scoped].sort(sortFn.sort);

  // Detail mode — different render path entirely.
  if (openNum != null) {
    const detail = all.drivers.find(d => d.num === openNum);
    return <DriverDetail
      detail={detail}
      onBack={() => setOpenNum(null)}
      onExit={onBack}
    />;
  }

  return <div style={{ paddingBottom:20 }}>
    <TopBar
      subtitle={`${all.drivers.length} driver${all.drivers.length === 1 ? '' : 's'} drafted this season`}
      title="Drivers"
      right={<BackChip onClick={onBack}/>}
    />

    {/* Awards strip — only if league has any data. Three quick-glance cards
        for banter: top scorer, most picked, sleeper of the season. */}
    {all.drivers.length > 0 && scope === 'league' && <Awards awards={all.awards} onOpen={setOpenNum}/>}

    {/* Scope toggle: League vs Mine */}
    <div style={{ padding:'14px 20px 0' }}>
      <div style={{
        display:'flex', gap:0, padding:3,
        background: T.card, border:`1px solid ${T.line2}`,
        borderRadius:6,
      }}>
        {[{id:'league', label:'League'}, {id:'mine', label:'My Picks'}].map(o => {
          const active = scope === o.id;
          return <button key={o.id} onClick={() => setScope(o.id)} style={{
            appearance:'none', flex:1,
            padding:'10px 12px',
            background: active ? T.ink : 'transparent',
            color: active ? T.bg : T.ink,
            border:'none', borderRadius:4,
            cursor:'pointer',
            fontFamily: FL, fontSize:10, fontWeight:600,
            letterSpacing:'0.22em', textTransform:'uppercase',
          }}>{o.label}</button>;
        })}
      </div>
    </div>

    {/* Sort chips */}
    <div style={{ padding:'10px 20px 0' }}>
      <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:6 }}>
        {SORTS.map(s => {
          const active = sortId === s.id;
          return <button key={s.id} onClick={() => setSortId(s.id)} style={{
            appearance:'none', flexShrink:0,
            padding:'7px 12px',
            background: active ? T.hot : T.card,
            color: active ? T.ink : T.ink,
            border: `1px solid ${active ? T.hot : T.line}`,
            borderRadius:3,
            cursor:'pointer',
            fontFamily: FL, fontSize:9, fontWeight:600,
            letterSpacing:'0.22em', textTransform:'uppercase',
          }}>Sort · {s.label}</button>;
        })}
      </div>
    </div>

    {/* Empty state */}
    {sorted.length === 0 && <div style={{ padding:'30px 28px', textAlign:'center' }}>
      <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:14, color: T.mute, lineHeight:1.5 }}>
        {scope === 'mine'
          ? "You haven't drafted any Cup drivers yet. Once you do, your picks show up here."
          : 'No drafts have been completed yet. Stats populate as the league finishes weeks.'}
      </div>
    </div>}

    {/* Leaderboard rows */}
    {sorted.length > 0 && <div style={{ padding:'10px 20px 20px' }}>
      {sorted.map((d, i) => {
        const primary = sortFn.fmt(d);
        // Secondary stat is always opposite-of-primary context — picks if sorting by perf, avg if by picks.
        const secondary = sortId === 'picks'
          ? `${d.avgPts} avg`
          : `${d.totalPicks}× drafted`;
        return <button key={d.num} onClick={() => setOpenNum(d.num)} style={{
          appearance:'none', width:'100%', textAlign:'left',
          background:'transparent', border:'none',
          padding:'12px 0',
          borderBottom: i === sorted.length-1 ? 'none' : `0.5px solid ${T.line2}`,
          display:'flex', alignItems:'center', gap:12,
          cursor:'pointer',
        }}>
          <div style={{
            fontFamily: FD, fontSize:14, fontWeight:600, fontStyle:'italic',
            width:24, color: i < 3 ? T.hot : T.mute, fontVariantNumeric:'tabular-nums',
          }}>{i+1}</div>
          <CarNum driver={d} size={36}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily: FD, fontSize:16, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1.1 }}>{d.name}</div>
            <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, color: T.mute, marginTop:3 }}>
              № {d.num} · {d.team} · {secondary}
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily: FB, fontSize:18, fontWeight:600, color: i === 0 ? T.hot : T.ink, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.01em' }}>{primary}</div>
            <div style={{ fontFamily: FL, fontSize:8, color: T.mute, letterSpacing:'0.18em', textTransform:'uppercase', marginTop:1 }}>
              {sortFn.label === 'Best Wk' ? 'PTS' : sortFn.label.toUpperCase()}
            </div>
          </div>
          <div style={{ color: T.mute, fontSize:14, marginLeft:4 }}>›</div>
        </button>;
      })}
    </div>}
  </div>;
}

// ── Awards strip — three "headline" cards above the leaderboard ────
function Awards({ awards, onOpen }) {
  const cards = [
    { key:'topScorer',    label:'Top Scorer',    sub:'most cumulative pts',     d: awards.topScorer,    metric: r => `${r.totalPts} pts`, ctx: r => `${r.totalPicks}× drafted` },
    { key:'mostPicked',   label:'Most Drafted',  sub:'league favorite',         d: awards.mostPicked,   metric: r => `${r.totalPicks}×`,  ctx: r => `${r.avgPts} avg` },
    { key:'bestSleeper',  label:'Sleeper',       sub:'high avg, low frequency', d: awards.bestSleeper,  metric: r => `${r.avgPts} avg`,   ctx: r => `${r.totalPicks}× drafted` },
  ].filter(c => c.d);

  if (cards.length === 0) return null;

  return <div style={{ padding:'14px 20px 0' }}>
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${cards.length}, 1fr)`, gap:8 }}>
      {cards.map(c => <button
        key={c.key}
        onClick={() => onOpen(c.d.num)}
        style={{
          appearance:'none', textAlign:'left',
          padding:'12px 12px 14px',
          background: T.card,
          border:`1px solid ${T.line2}`, borderRadius:6,
          cursor:'pointer',
          display:'flex', flexDirection:'column', gap:6,
        }}
      >
        <div style={{ fontFamily: FL, fontSize:8, fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', color: T.hot }}>{c.label}</div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <CarNum driver={c.d} size={26}/>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontFamily: FD, fontSize:13, fontWeight:600, letterSpacing:'-0.02em', lineHeight:1.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.d.name}</div>
            <div style={{ fontFamily: FB, fontSize:13, fontWeight:600, color: T.ink, fontVariantNumeric:'tabular-nums', marginTop:2 }}>{c.metric(c.d)}</div>
          </div>
        </div>
        <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:10, color: T.mute, lineHeight:1.4 }}>{c.ctx(c.d)}</div>
      </button>)}
    </div>
  </div>;
}

// ── Driver Detail — full per-driver breakdown ──────────────────────
function DriverDetail({ detail, onBack, onExit }) {
  if (!detail) {
    return <div style={{ paddingBottom:20 }}>
      <TopBar title="Driver" right={<BackChip onClick={onBack}/>}/>
      <div style={{ padding:'40px 28px', textAlign:'center', fontFamily: FI, fontStyle:'italic', fontSize:14, color: T.mute }}>
        Driver not found.
      </div>
    </div>;
  }

  const { num, name, team, totalPicks, totalPts, avgPts, bestWeek, worstWeek, byPlayer, weeks } = detail;

  return <div style={{ paddingBottom:20 }}>
    <TopBar
      subtitle={`№ ${num} · ${team}`}
      title={name}
      right={<BackChip onClick={onBack} label="Drivers"/>}
    />

    {/* Hero — large livery chip + name */}
    <div style={{ padding:'0 20px 18px' }}>
      <div style={{
        background: T.ink, color: T.bg, borderRadius:4, padding:'20px',
        display:'flex', alignItems:'center', gap:18,
      }}>
        <CarNum driver={detail} size={68}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.24em', textTransform:'uppercase', color:'rgba(247,244,237,0.45)' }}>Season</div>
          <div style={{ fontFamily: FD, fontSize:30, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1, marginTop:4 }}>{name}</div>
          <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:13, color:'rgba(247,244,237,0.65)', marginTop:6 }}>{team}</div>
        </div>
      </div>
    </div>

    {/* Quad of metric cards: picks · avg · total · best */}
    <div style={{ padding:'0 20px 14px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6 }}>
        <Metric label="Picks" value={totalPicks}/>
        <Metric label="Avg" value={avgPts}/>
        <Metric label="Total" value={totalPts} hot/>
        <Metric label="Best" value={bestWeek?.pts ?? '—'} sub={bestWeek ? `Wk ${String(bestWeek.wk).padStart(2,'0')}` : null}/>
      </div>
    </div>

    {/* Per-owner breakdown — who drafted them and how each fared */}
    {byPlayer.length > 0 && <>
      <SectionLabel right={<span style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, textTransform:'none', letterSpacing:'0.01em', color: T.mute }}>{byPlayer.length} owner{byPlayer.length === 1 ? '' : 's'}</span>}>By Owner</SectionLabel>
      <div style={{ padding:'10px 20px 18px' }}>
        {byPlayer.map((b, i) => <div key={b.playerId} style={{
          display:'flex', alignItems:'center', gap:12,
          padding:'12px 0',
          borderBottom: i === byPlayer.length-1 ? 'none' : `0.5px solid ${T.line2}`,
        }}>
          <PlayerBadge player={{ name: b.playerName, color: b.color, initial: b.playerName[0] }} size={26}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily: FD, fontSize:16, fontWeight:600, letterSpacing:'-0.02em' }}>{b.playerName}</div>
            <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, color: T.mute, marginTop:2 }}>
              {b.picks}× drafted · best {b.bestPts} pts
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily: FB, fontSize:16, fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{b.totalPts}</div>
            <div style={{ fontFamily: FL, fontSize:8, color: T.mute, letterSpacing:'0.18em', textTransform:'uppercase' }}>{b.avgPts} avg</div>
          </div>
        </div>)}
      </div>
    </>}

    {/* Per-week breakdown — chronological list of every week they were drafted */}
    {weeks.length > 0 && <>
      <SectionLabel right={<span style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, textTransform:'none', letterSpacing:'0.01em', color: T.mute }}>{weeks.length} week{weeks.length === 1 ? '' : 's'}</span>}>Race-by-Race</SectionLabel>
      <div style={{ padding:'10px 20px 24px' }}>
        {[...weeks].reverse().map((w, i) => {
          const isBest = bestWeek && w.wk === bestWeek.wk && w.pts === bestWeek.pts;
          return <div key={w.wk} style={{
            display:'flex', alignItems:'center', gap:12,
            padding:'10px 0',
            borderBottom: i === weeks.length-1 ? 'none' : `0.5px solid ${T.line2}`,
          }}>
            <div style={{ fontFamily: FL, fontSize:10, letterSpacing:'0.2em', textTransform:'uppercase', color: T.mute, width:42 }}>
              Wk {String(w.wk).padStart(2,'0')}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily: FD, fontSize:14, fontWeight:600, letterSpacing:'-0.02em', lineHeight:1.1 }}>{w.track}</div>
              <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:3 }}>
                <PlayerBadge player={{ name: w.ownerName, color: w.ownerColor, initial: w.ownerName[0] }} size={12}/>
                <span style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, color: T.mute }}>{w.ownerName}</span>
              </div>
            </div>
            <div style={{ fontFamily: FB, fontSize:15, fontWeight:600, color: isBest ? T.hot : T.ink, fontVariantNumeric:'tabular-nums' }}>{w.pts}</div>
          </div>;
        })}
      </div>
    </>}
  </div>;
}

// Tiny metric card — used in the detail hero quad. `hot` highlights the
// "headline" stat (total pts) in copper.
function Metric({ label, value, sub, hot }) {
  return <div style={{
    background: T.card, border:`1px solid ${T.line2}`, borderRadius:6,
    padding:'10px 8px', textAlign:'center',
  }}>
    <div style={{ fontFamily: FL, fontSize:8, fontWeight:600, letterSpacing:'0.22em', textTransform:'uppercase', color: T.mute }}>{label}</div>
    <div style={{ fontFamily: FB, fontSize:20, fontWeight:600, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.02em', color: hot ? T.hot : T.ink, marginTop:4 }}>{value}</div>
    {sub && <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:10, color: T.mute, marginTop:2 }}>{sub}</div>}
  </div>;
}
