'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackChip, PlayerBadge, SectionLabel, TopBar, WinsCount } from '@/components/ui/primitives';
import { FB, FD, FI, FL, T } from '@/lib/constants';
import { computeStandings, finalizedWeeks, isSeasonComplete, standingsThroughWeek } from '@/lib/utils';

// Compute trend signals for one player. Returns null if there's no
// completed week yet (nothing to trend on). All three signals are
// independent — any may be absent (e.g., movement is undefined after
// one completed week, streak is hidden if it isn't at least 2).
//   form        — last up-to-3 weekly point totals (oldest → newest)
//   formAvg     — arithmetic mean of `form`, rounded to the nearest int
//   movement    — season-rank delta: priorRank - currentRank
//                 (positive means the player CLIMBED; negative means they fell)
//   streakTop3  — consecutive most-recent weeks ranked 1-3 by weekly pts
//   lastWk      — wk number of the most recent completed week (for labels)
// `completedResults` must already be filtered to finished weeks — an
// in-progress row would skew form, rank movement and the top-3 streak with
// half-entered points.
function computePlayerTrends(completedResults, players, playerId) {
  if (!playerId) return null;
  if (!completedResults || completedResults.length === 0) return null;
  const weeklyResults = completedResults;

  const completed = [...completedResults].sort((a, b) => a.wk - b.wk);
  const lastWk = completed[completed.length - 1].wk;
  const form = completed.slice(-3).map(w => Number(w.pts?.[playerId]) || 0);
  const formAvg = form.length
    ? Math.round(form.reduce((a, b) => a + b, 0) / form.length)
    : 0;

  // Season-rank movement. We re-use computeStandings because the ranking
  // includes ties handled the same way as the main list (descending pts;
  // identical pts share the same .findIndex result, which is fine —
  // movement only reports the visible-list delta either way).
  const rankAt = (throughWk) => {
    const s = computeStandings(players, weeklyResults, throughWk);
    const ordered = [...s].sort((a, b) => b.seasonPts - a.seasonPts);
    const idx = ordered.findIndex(p => p.id === playerId);
    return idx >= 0 ? idx + 1 : null;
  };
  const currentRank = rankAt(lastWk);
  const priorRank = completed.length >= 2
    ? rankAt(completed[completed.length - 2].wk)
    : null;
  const movement = priorRank != null && currentRank != null
    ? { delta: priorRank - currentRank, currentRank, priorWk: completed[completed.length - 2].wk }
    : null;

  // Top-3 streak from the most recent week backward. Per-week ranks here
  // are by WEEKLY pts (not cumulative) so a single hot week still counts.
  let streakTop3 = 0;
  for (let i = completed.length - 1; i >= 0; i--) {
    const w = completed[i];
    const entries = Object.entries(w.pts || {})
      .map(([pid, pts]) => ({ pid, pts: Number(pts) || 0 }))
      .sort((a, b) => b.pts - a.pts);
    const pos = entries.findIndex(e => e.pid === playerId);
    if (pos >= 0 && pos < 3) streakTop3++;
    else break;
  }

  return { form, formAvg, movement, streakTop3, lastWk };
}

// ── Trend strip ────────────────────────────────────────────────────
// Inline subrow rendered under every player's main standings row.
// Combines form sparkline + rank-movement chip + top-3 streak chip when
// each has enough data to be meaningful. Identical treatment for every
// player so the list reads at a glance.
function TrendStrip({ trends }) {
  const { form, formAvg, movement, streakTop3 } = trends;
  const showMovement = !!movement && movement.delta !== 0;
  const showStreak = streakTop3 >= 2;
  if (form.length === 0 && !showMovement && !showStreak) return null;
  return <div style={{
    marginTop:10,
    display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
  }}>
    {form.length > 0 && <FormSparkline values={form} avg={formAvg}/>}
    {showMovement && <MovementChip movement={movement}/>}
    {showStreak && <StreakChip count={streakTop3}/>}
  </div>;
}

function FormSparkline({ values, avg }) {
  const max = Math.max(1, ...values);
  return <span style={{ display:'inline-flex', alignItems:'center', gap:7 }}>
    <span style={{
      fontFamily: FL, fontSize:8, fontWeight:700,
      letterSpacing:'0.22em', textTransform:'uppercase', color: T.mute,
    }}>L{values.length}</span>
    <span style={{ display:'inline-flex', alignItems:'flex-end', gap:2, height:14 }}>
      {values.map((v, i) => (
        <span key={i} style={{
          display:'inline-block', width:5,
          height:`${Math.max(2, Math.round((v / max) * 14))}px`,
          background: i === values.length - 1 ? T.ink : T.ink2,
          borderRadius:1,
        }}/>
      ))}
    </span>
    <span style={{
      fontFamily: FB, fontSize:11, fontWeight:500,
      color: T.ink2, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.01em',
    }}>
      {values.join(' · ')}
      <span style={{ color: T.mute, fontWeight:500 }}> · avg {avg}</span>
    </span>
  </span>;
}

function MovementChip({ movement }) {
  const { delta, priorWk } = movement;
  // Zero-delta is filtered out at the TrendStrip level — keeping the
  // chip silent when nothing changed avoids a "hold" tagline that just
  // takes up space without conveying anything new.
  if (delta === 0) return null;
  const up = delta > 0;
  const wkLabel = `since wk ${String(priorWk).padStart(2,'0')}`;
  return <span style={{
    display:'inline-flex', alignItems:'center', gap:4,
    fontFamily: FB, fontSize:11, fontWeight:600,
    color: up ? T.good : T.danger,
    fontVariantNumeric:'tabular-nums',
  }}>
    <span style={{ fontSize:13, lineHeight:1 }}>{up ? '↑' : '↓'}</span>
    {Math.abs(delta)}
    <span style={{ color: T.mute, fontWeight:500 }}>{wkLabel}</span>
  </span>;
}

function StreakChip({ count }) {
  return <span style={{
    fontFamily: FL, fontSize:8, fontWeight:700,
    letterSpacing:'0.22em', textTransform:'uppercase',
    color: T.hot,
    padding:'3px 7px',
    border:`1px solid ${T.hot}`, borderRadius:2,
  }}>Top-3 · {count}w</span>;
}

// Builds a plain-text version of the standings suitable for pasting into the
// league group chat. Aligned columns via padEnd. Includes weekly-wins count
// for top-3 finishers (skipped for 0-win players to keep the line tight).
//
// Example output:
//   🏁 Harvest Moon · Through Wk 10
//   1. Justin    1,847 pts · 3W
//   2. Tone      1,723 pts · 2W
//   3. Boomer    1,654 pts · 1W
//   4. Soup      1,489 pts
//   5. Chad      1,432 pts
//   6. Trey      1,278 pts
function formatStandingsText(sorted, throughWeek) {
  const nameWidth = Math.max(...sorted.map(p => p.name.length));
  const lines = sorted.map((p, i) => {
    const pad = p.name.padEnd(nameWidth, ' ');
    const wins = p.wins > 0 ? ` · ${p.wins}W` : '';
    return `${i + 1}. ${pad}  ${p.seasonPts.toLocaleString()} pts${wins}`;
  });
  return [
    `🏁 Harvest Moon · Through Wk ${String(throughWeek).padStart(2, '0')}`,
    ...lines,
  ].join('\n');
}

// Best-effort clipboard write. Modern browsers expose navigator.clipboard;
// older ones / non-secure contexts fall back to the textarea + execCommand
// trick. Returns true on success, false otherwise so the UI can decide
// whether to show "Copied" or surface an error.
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function StandingsScreen({ state, me, onNav }) {
  const { players, weeklyResults, currentWeek } = state;
  // Includes the final race once the season is complete — see
  // standingsThroughWeek. Mid-season this is exactly currentWeek - 1.
  const throughWk = standingsThroughWeek(state);
  const seasonComplete = isSeasonComplete(state);
  const standings = computeStandings(players, weeklyResults, throughWk);
  const sorted = [...standings].sort((a,b) => b.seasonPts - a.seasonPts);
  // Completed weeks only, declared before its consumers below. Filters out the
  // current week's in-progress row — written on every keystroke during results
  // entry — which would otherwise appear as a By-Week column the season totals
  // above it exclude, and would skew the trend signals with partial points.
  const completedWeeks = finalizedWeeks(weeklyResults, currentWeek).sort((a,b) => b.wk - a.wk);
  // Trend signals computed per player. Keyed by id so the row map can do a
  // plain lookup. Re-runs whenever state changes — 6 players × ~14 weeks is
  // a few thousand ops, negligible.
  const trendsById = useMemo(() => {
    const map = {};
    sorted.forEach(p => { map[p.id] = computePlayerTrends(completedWeeks, players, p.id); });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  // Bars normalized to the SPREAD between leader and last place, not to the
  // leader's absolute total. After 11 weeks of cumulative points, every
  // player's bar would be ~70-95% full when normalized to the leader — they
  // all look the same. By normalizing to (current - min) / (max - min), the
  // gaps between players become readable: leader is full, last place is
  // empty, midfield reads proportionally. Tells the league-is-close vs
  // league-is-runaway story at a glance.
  const minPts = Math.min(...sorted.map(s => s.seasonPts));
  const maxPts = Math.max(...sorted.map(s => s.seasonPts));
  const spread = Math.max(1, maxPts - minPts);
  // Copy-to-clipboard state. After a successful copy we flip the chip to
  // "Copied" for ~1.5s so the user sees confirmation before it resets.
  const [copyState, setCopyState] = useState('idle'); // 'idle' | 'ok' | 'err'
  const onCopy = async () => {
    const text = formatStandingsText(sorted, throughWk);
    const ok = await copyText(text);
    setCopyState(ok ? 'ok' : 'err');
    setTimeout(() => setCopyState('idle'), 1500);
    try { navigator.vibrate?.(20); } catch {}
  };
  const canCopy = completedWeeks.length > 0;

  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle={seasonComplete ? 'Final · Season Complete' : `Through Week ${String(throughWk).padStart(2,'0')}`} title="Standings" right={<BackChip onClick={() => onNav('back')}/>}/>

    <div style={{ padding:'0 20px 20px' }}>
      <div style={{ background: T.ink, color: T.bg, borderRadius:4, padding:'22px 20px', position:'relative' }}>
        {/* Copy chip — only meaningful once at least one week is final. */}
        {canCopy && <button onClick={onCopy} style={{
          position:'absolute', top:14, right:14,
          appearance:'none',
          background: copyState === 'ok' ? T.hot : 'rgba(247,244,237,0.10)',
          color: copyState === 'ok' ? T.ink : T.bg,
          border:`0.5px solid ${copyState === 'ok' ? T.hot : 'rgba(247,244,237,0.25)'}`,
          padding:'7px 11px', borderRadius:3, cursor:'pointer',
          fontFamily: FL, fontSize:9, fontWeight:600,
          letterSpacing:'0.2em', textTransform:'uppercase',
          transition:'background 150ms, color 150ms, border-color 150ms',
        }}>
          {copyState === 'ok' ? '✓ Copied' : copyState === 'err' ? 'Try again' : '↗ Copy'}
        </button>}
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
        const isMe = me && p.id === me.id;
        // Bar fill: percent of the field's spread, with a tiny floor so last
        // place still shows a sliver. The leader gets 100%, last gets ~6%,
        // midfield is proportional. With one or zero completed weeks
        // everyone has equal points → spread = 1 → bars all read full,
        // which is honest ("nobody's ahead yet").
        const barPct = Math.max(6, Math.round(((p.seasonPts - minPts) / spread) * 100));
        return <div key={p.id} style={{
          padding:'14px 0 14px 12px',
          marginLeft:-12,
          borderBottom: i === sorted.length-1 ? 'none' : `0.5px solid ${T.line2}`,
          borderLeft: isMe ? `2px solid ${T.hot}` : '2px solid transparent',
          display:'flex', alignItems:'center', gap:14,
        }}>
          <div style={{ fontFamily: FD, fontSize:20, fontWeight:600, width:26, color: T.ink, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{String(i+1).padStart(2,'0')}</div>
          <PlayerBadge player={p} size={26} onClick={() => onNav('team', { playerId: p.id })}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <span style={{ fontFamily: FD, fontSize:20, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1 }}>{p.name}</span>
              {isMe && <span style={{
                fontFamily: FL, fontSize:8, fontWeight:700,
                letterSpacing:'0.22em', textTransform:'uppercase',
                color: T.hot,
                padding:'2px 6px',
                border:`1px solid ${T.hot}`, borderRadius:2,
              }}>You</span>}
              <WinsCount wins={p.wins}/>
            </div>
            <div style={{ marginTop:6, height:2, background: T.bg2, borderRadius:0 }}>
              <div style={{
                width: `${barPct}%`, height:'100%',
                background: i === 0 ? T.hot : (isMe ? T.ink : T.ink2),
                transition:'width 380ms cubic-bezier(0.32,0.72,0,1)',
              }}/>
            </div>
            {trendsById[p.id] && <TrendStrip trends={trendsById[p.id]}/>}
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
      <SectionLabel>By Week</SectionLabel>
      <div style={{ padding:'14px 20px 20px' }}>
        <ScrollableWeekTable
          completedWeeks={completedWeeks}
          sorted={sorted}
          me={me}
          onNav={onNav}
        />
      </div>
    </>}
  </div>;
}

// ── Scrollable By-Week table with edge-fade discoverability ─────────
// The table is wider than the viewport whenever the league has played
// more than ~5 weeks. The previous "Scroll →" italic hint above the
// table was easy to miss. This component overlays a fade gradient and
// a small chevron pip on whichever edge has more content beyond the
// current scroll position. Pure CSS gradients + a scroll listener that
// toggles two booleans (hasMoreLeft / hasMoreRight). The pip points in
// the direction the user can still scroll, mirroring how iOS surfaces
// scrollable areas in apps like Photos.
function ScrollableWeekTable({ completedWeeks, sorted, me, onNav }) {
  const scrollRef = useRef(null);
  const [hasMoreLeft, setHasMoreLeft] = useState(false);
  const [hasMoreRight, setHasMoreRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      // 2px tolerance so subpixel scroll positions don't flicker the pip
      // on/off at the boundaries.
      setHasMoreLeft(el.scrollLeft > 2);
      setHasMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    // Re-check on window resize since clientWidth changes with rotation.
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
    // Re-run when the column count changes (e.g. a new week is added).
  }, [completedWeeks.length]);

  return <div style={{
    position:'relative',
    borderTop:`0.5px solid ${T.line}`, borderBottom:`0.5px solid ${T.line}`,
  }}>
    <div ref={scrollRef} style={{
      overflowX:'auto', overflowY:'hidden',
      // touchAction tells the browser horizontal panning is the intent so it
      // doesn't compete with the parent PullToRefresh / vertical page scroll
      // for the gesture. WebkitOverflowScrolling adds iOS momentum so a flick
      // actually carries instead of stopping the instant your finger lifts.
      // overscrollBehaviorX contains the swipe so it doesn't trigger a
      // browser back-nav at the edges.
      touchAction:'pan-x',
      WebkitOverflowScrolling:'touch',
      overscrollBehaviorX:'contain',
    }}>
      <div style={{
        display:'grid',
        gridTemplateColumns:`88px repeat(${completedWeeks.length}, 52px) 64px`,
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
      {sorted.map((p, pi) => {
        const isMe = me && p.id === me.id;
        // Solid color (not rgba) so the sticky Player column is fully opaque
        // when scrolling — otherwise the week-points cells visibly slide
        // under the name. Composited from rgba(184,147,90,0.08) over T.bg.
        const rowBg = isMe ? '#F2ECE1' : T.bg;
        return <div key={p.id} style={{
          display:'grid',
          gridTemplateColumns:`88px repeat(${completedWeeks.length}, 52px) 64px`,
          alignItems:'center',
          background: rowBg,
          borderBottom: pi === sorted.length-1 ? 'none' : `0.5px solid ${T.line2}`,
        }}>
          <div style={{
            padding:'10px 6px', display:'flex', alignItems:'center', gap:6,
            position:'sticky', left:0, background: rowBg,
          }}>
            <PlayerBadge player={p} size={18} onClick={() => onNav('team', { playerId: p.id })}/>
            <span style={{ fontFamily: FD, fontSize:14, fontWeight:600, letterSpacing:'-0.03em' }}>{p.name.slice(0,6)}</span>
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
        </div>;
      })}
    </div>
    {/* Edge-fade gradients + chevron pips. Each layer is pointer-events:
        none so they don't block scroll/touch. The gradients start fully
        opaque against the cream bg at the edge and fade to transparent
        ~32px in, giving a soft hint that more content lives offscreen. */}
    {hasMoreLeft && <div style={{
      position:'absolute', left:0, top:0, bottom:0, width:32,
      pointerEvents:'none',
      background:`linear-gradient(90deg, ${T.bg} 0%, rgba(247,244,237,0) 100%)`,
    }}/>}
    {hasMoreRight && <div style={{
      position:'absolute', right:0, top:0, bottom:0, width:32,
      pointerEvents:'none',
      background:`linear-gradient(270deg, ${T.bg} 0%, rgba(247,244,237,0) 100%)`,
    }}/>}
    {hasMoreRight && <div style={{
      position:'absolute', right:6, top:'50%', transform:'translateY(-50%)',
      pointerEvents:'none',
      width:18, height:18, borderRadius:'50%',
      background: T.ink, color: T.bg,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:11, fontFamily: FD, lineHeight:1,
      boxShadow:'0 1px 4px rgba(0,0,0,0.15)',
    }}>›</div>}
    {hasMoreLeft && <div style={{
      position:'absolute', left:6, top:'50%', transform:'translateY(-50%)',
      pointerEvents:'none',
      width:18, height:18, borderRadius:'50%',
      background: T.ink, color: T.bg,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:11, fontFamily: FD, lineHeight:1,
      boxShadow:'0 1px 4px rgba(0,0,0,0.15)',
    }}>‹</div>}
  </div>;
}
