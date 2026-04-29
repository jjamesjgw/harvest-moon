'use client';
import React, { useState } from 'react';
import { BackChip, PlayerBadge, SectionLabel, TopBar, WinsCount } from '@/components/ui/primitives';
import { FB, FD, FI, FL, T } from '@/lib/constants';
import { computeStandings } from '@/lib/utils';

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
  const standings = computeStandings(players, weeklyResults, currentWeek - 1);
  const sorted = [...standings].sort((a,b) => b.seasonPts - a.seasonPts);
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
  const completedWeeks = weeklyResults.slice().sort((a,b) => a.wk - b.wk);

  // Copy-to-clipboard state. After a successful copy we flip the chip to
  // "Copied" for ~1.5s so the user sees confirmation before it resets.
  const [copyState, setCopyState] = useState('idle'); // 'idle' | 'ok' | 'err'
  const onCopy = async () => {
    const text = formatStandingsText(sorted, currentWeek - 1);
    const ok = await copyText(text);
    setCopyState(ok ? 'ok' : 'err');
    setTimeout(() => setCopyState('idle'), 1500);
    try { navigator.vibrate?.(20); } catch {}
  };
  const canCopy = completedWeeks.length > 0;

  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle={`Through Week ${String(currentWeek - 1).padStart(2,'0')}`} title="Standings" right={<BackChip onClick={() => onNav('home')}/>}/>

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
          <PlayerBadge player={p} size={26}/>
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
          {sorted.map((p, pi) => {
            const isMe = me && p.id === me.id;
            // Subtle warm tint on the user's row — uses the same copper as
            // the season-ranking accent but at low alpha so the column data
            // remains readable. The sticky name cell uses the same tinted
            // background so it doesn't visually fall off when scrolled.
            const rowBg = isMe ? 'rgba(184,147,90,0.08)' : T.bg;
            return <div key={p.id} style={{
              display:'grid',
              gridTemplateColumns:`72px repeat(${completedWeeks.length}, 38px) 56px`,
              alignItems:'center',
              background: rowBg,
              borderBottom: pi === sorted.length-1 ? 'none' : `0.5px solid ${T.line2}`,
            }}>
              <div style={{
                padding:'10px 6px', display:'flex', alignItems:'center', gap:6,
                position:'sticky', left:0, background: rowBg,
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
            </div>;
          })}
        </div>
      </div>
    </>}
  </div>;
}
