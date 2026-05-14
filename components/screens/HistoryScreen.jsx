'use client';
import React, { useState } from 'react';
import { BackChip, CarNum, PlayerBadge, TopBar } from '@/components/ui/primitives';
import { ADMIN_ID, FB, FD, FI, FL, SERIES, T } from '@/lib/constants';
import { resolvePickDriver } from '@/lib/utils';

// Small series tag rendered next to a bonus chip ("TRK", "O'R", "HL").
function SeriesTag({ series }) {
  if (!series || series === 'Cup') return null;
  const meta = SERIES[series] || { short: series.slice(0,3).toUpperCase(), color: T.hot };
  return <span style={{
    display:'inline-block',
    padding:'1px 4px', borderRadius:2,
    background: T.hot, color: '#fff',
    fontFamily: FL, fontSize:7, fontWeight:700,
    letterSpacing:'0.16em', textTransform:'uppercase',
    verticalAlign:'middle', marginLeft:3,
  }}>{meta.short}</span>;
}

export default function HistoryScreen({ state, me, onBack, onEdit, onNav }) {
  const { players, schedule = [], weeklyResults, draftHistory = [] } = state;
  // Multi-expand. The single-expand UX fought the most common analytical
  // use case ("how did Trey do at Bristol last spring vs this fall?") —
  // opening row B closed row A. Now expansions accumulate; users can keep
  // any number of weeks open. The header gains a "Collapse all" affordance
  // when at least one row is open, so it's still easy to clear the view.
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (wk) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(wk)) next.delete(wk); else next.add(wk);
    return next;
  });
  const collapseAll = () => setExpanded(new Set());

  const isAdmin = me?.id === ADMIN_ID;
  // Clone before sort: Array.prototype.sort mutates in place, and weeklyResults
  // is shared React state — sorting it directly reorders the live array and
  // corrupts any other reader (cron ingest, recap derivations, etc.).
  const results = [...weeklyResults].sort((a,b) => b.wk - a.wk);

  return <div style={{ paddingBottom:20 }}>
    <TopBar
      subtitle={`${results.length} completed week${results.length === 1 ? '' : 's'}`}
      title="History"
      right={<BackChip onClick={onBack}/>}
    />
    {expanded.size > 0 && <div style={{ padding:'0 20px 4px', display:'flex', justifyContent:'flex-end' }}>
      <button onClick={collapseAll} style={{
        appearance:'none', background:'transparent', border:'none',
        padding:'4px 6px', cursor:'pointer',
        fontFamily: FL, fontSize:9, fontWeight:600,
        letterSpacing:'0.22em', textTransform:'uppercase', color: T.mute,
      }}>Collapse all ({expanded.size})</button>
    </div>}
    <div style={{ padding:'14px 20px 20px' }}>
      {results.length === 0 ? (
        <div style={{ padding:'28px 10px', textAlign:'center', fontFamily: FI, fontStyle:'italic', fontSize:14, color: T.mute }}>
          No past weeks yet. Finish a draft and enter results to build history.
        </div>
      ) : results.map((w, idx) => {
        const h = draftHistory.find(d => d.wk === w.wk);
        const meta = schedule.find(s => s.wk === w.wk);
        const pts = Object.entries(w.pts);
        const topPid = pts.reduce((m, [pid, v]) => (!m || v > m[1]) ? [pid, v] : m, null);
        const winner = topPid ? players.find(p => p.id === topPid[0]) : null;
        const isExp = expanded.has(w.wk);
        return <div key={w.wk} style={{ borderBottom: idx === results.length-1 ? 'none' : `0.5px solid ${T.line2}` }}>
          <button onClick={() => toggle(w.wk)} style={{
            appearance:'none', width:'100%', background:'transparent', border:'none',
            padding:'14px 0', cursor:'pointer', textAlign:'left',
            display:'flex', alignItems:'center', gap:14,
          }}>
            <div style={{ fontFamily: FL, fontSize:10, fontWeight:500, letterSpacing:'0.2em', textTransform:'uppercase', color: T.mute, width:42 }}>Wk {String(w.wk).padStart(2,'0')}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em' }}>{meta?.raceName || w.track}</div>
              {meta?.raceName && <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.ink2, marginTop:2 }}>{w.track}</div>}
              {winner && <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                <PlayerBadge player={winner} size={14}/>
                <span style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute }}>{winner.name} · {topPid[1]} pts</span>
              </div>}
            </div>
            <div style={{ color: T.mute, fontFamily: FD, fontSize:18, fontStyle:'italic' }}>{isExp ? '—' : '+'}</div>
          </button>
          {isExp && <>
            {h && <div style={{ paddingBottom:14 }}>
              {[...players]
                .sort((a, b) => (w.pts[b.id] || 0) - (w.pts[a.id] || 0))
                .map(p => {
                  const roster = h.picks.filter(pk => pk.playerId === p.id);
                  const isTop = topPid && p.id === topPid[0];
                  return <div key={p.id} style={{
                    padding:'10px 0', display:'flex', alignItems:'center', gap:10,
                    borderTop:`0.5px solid ${T.line2}`,
                  }}>
                    <PlayerBadge player={p} size={18}/>
                    <span style={{ fontFamily: FD, fontSize:14, width:66, letterSpacing:'-0.03em' }}>{p.name}</span>
                    <div style={{ display:'flex', gap:4, flex:1, flexWrap:'wrap', alignItems:'center' }}>
                      {roster.map((pk, pi) => {
                        const d = resolvePickDriver(state, w.wk, pk);
                        const series = pk.series || 'Cup';
                        return <span key={`${series}:${pk.driverNum}:${pi}`} style={{ display:'inline-flex', alignItems:'center' }}>
                          <CarNum driver={d} size={22}
                            onClick={series === 'Cup' && onNav ? () => onNav('drivers', { driverNum: d.num }) : undefined}/>
                          <SeriesTag series={series}/>
                        </span>;
                      })}
                    </div>
                    <span style={{ fontFamily: FB, fontSize:13, fontWeight:600, fontVariantNumeric:'tabular-nums', color: isTop ? T.hot : T.ink }}>{w.pts[p.id] || 0}</span>
                  </div>;
                })}
            </div>}
            {!h && <div style={{ padding:'10px 0 14px', fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute }}>
              Draft wasn't recorded for this week.
            </div>}
            {isAdmin && h && <div style={{ paddingBottom:14, paddingTop:6 }}>
              <button onClick={() => onEdit(w.wk)} style={{
                appearance:'none', width:'100%',
                background: T.hot, color: T.ink,
                border:'none', borderRadius:3,
                padding:'12px 14px', cursor:'pointer',
                fontFamily: FL, fontSize:10, fontWeight:600,
                letterSpacing:'0.22em', textTransform:'uppercase',
              }}>✎ Edit Week {String(w.wk).padStart(2,'0')} Results</button>
            </div>}
          </>}
        </div>;
      })}
    </div>
  </div>;
}
