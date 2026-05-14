'use client';
import React from 'react';
import { CarNum, LinkArrow, PlayerBadge, RaceCountdown, SectionLabel, TopBar } from '@/components/ui/primitives';
import { InstallHint } from '@/components/ui/InstallHint';
import { ADMIN_ID, FB, FD, FI, FL, FM, T } from '@/lib/constants';
import { getWeekConfig, ordinalSuffix, raceCountdown } from '@/lib/utils';
import { DEFAULT_DRIVERS } from '@/lib/data';
import { RACE_QUOTES } from '@/lib/quotes';

const STAT_AWARDS = [
  { key: 'topScorer',   label: 'Top Scorer',   metric: r => `${r.totalPts} pts`,   sub: r => `${r.totalPicks}× drafted` },
  { key: 'mostPicked',  label: 'Most Drafted', metric: r => `${r.totalPicks}×`,    sub: r => `${r.avgPts} avg`        },
  { key: 'bestSleeper', label: 'Sleeper',      metric: r => `${r.avgPts} avg`,     sub: r => `${r.totalPicks}× drafted` },
];

function StatOfTheSeason({ state, driverStats, onNav }) {
  const all = driverStats;
  // Rotate weekly. Fall through to the next non-null award if the
  // selected slot is empty (e.g. Wk 1 before any race finalized).
  const wk = state.currentWeek || 1;
  let slot = null;
  let driver = null;
  for (let i = 0; i < STAT_AWARDS.length; i++) {
    const candidate = STAT_AWARDS[(wk + i) % STAT_AWARDS.length];
    const d = all.awards?.[candidate.key];
    if (d) { slot = candidate; driver = d; break; }
  }
  if (!driver) return null;
  return <>
    <SectionLabel right={<LinkArrow onClick={() => onNav('drivers')}>All</LinkArrow>}>
      Stat of the Season · {slot.label}
    </SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      <button
        onClick={() => onNav('drivers', { driverNum: driver.num })}
        style={{
          appearance:'none', width:'100%', textAlign:'left',
          background: T.card, border:`1px solid ${T.line2}`, borderRadius:6,
          padding:'12px 14px', cursor:'pointer',
          display:'flex', alignItems:'center', gap:12,
        }}>
        <CarNum driver={driver} size={36}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily: FD, fontSize:16, fontWeight:600, letterSpacing:'-0.02em' }}>{driver.name}</div>
          <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, color: T.mute, marginTop:2 }}>
            № {driver.num} · {driver.team} · {slot.sub(driver)}
          </div>
        </div>
        <div style={{ fontFamily: FB, fontSize:18, fontWeight:600, color: T.hot, fontVariantNumeric:'tabular-nums' }}>{slot.metric(driver)}</div>
      </button>
    </div>
  </>;
}

function YourRosterStrip({ state, me, onNav }) {
  const { currentWeek, draftState, weeklyResults } = state;
  const myPicks = (draftState?.picks || []).filter(p => p.playerId === me.id);

  // Resolve each pick to its driver (Cup uses DEFAULT_DRIVERS + week extras;
  // bonus series come from bonusDriversByWeek). We keep series alongside the
  // resolved driver so the chip can render a small series tag for non-Cup.
  const wkExtras = (state.weekDriversExtra || {})[currentWeek] || [];
  const cupPool = [...DEFAULT_DRIVERS, ...wkExtras];
  const resolved = myPicks.map(pk => {
    const series = pk.series || 'Cup';
    const pool = series === 'Cup'
      ? cupPool
      : (state.bonusDriversByWeek?.[currentWeek]?.[series] || []);
    const driver = pool.find(d => d.num === pk.driverNum)
      || { num: pk.driverNum, name: pk.driverName || `#${pk.driverNum}`, primary: T.mute, secondary: T.ink };
    return { series, driver };
  });

  const wkResult = (weeklyResults || []).find(w => w.wk === currentWeek);
  const myWkPts = wkResult?.pts?.[me.id];

  return <>
    <SectionLabel right={<LinkArrow onClick={() => onNav('team')}>View</LinkArrow>}>
      Your Roster · Wk {String(currentWeek).padStart(2,'0')}
    </SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      <div style={{
        background: T.card, border:`1px solid ${T.line2}`, borderRadius:6,
        padding:'12px 14px',
        display:'flex', alignItems:'center', gap:10,
      }}>
        {resolved.length === 0 ? <>
          {[0,1,2,3].map(i => <div key={i} style={{
            width:36, height:36, borderRadius:4,
            background:'rgba(20,17,13,0.06)',
            border:`0.5px dashed ${T.line2}`,
          }}/>)}
          <div style={{ flex:1, fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute, marginLeft:6 }}>
            Drafting…
          </div>
        </> : <>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', flex:1 }}>
            {resolved.map(({ series, driver }, i) => <div key={`${series}:${driver.num}:${i}`} style={{ display:'inline-flex', alignItems:'center' }}>
              <CarNum driver={driver} size={32} onClick={series === 'Cup' ? () => onNav('drivers', { driverNum: driver.num }) : undefined}/>
              {series !== 'Cup' && <span style={{
                marginLeft:-4, padding:'1px 4px', borderRadius:2,
                background: T.hot, color:'#fff',
                fontFamily: FL, fontSize:7, fontWeight:700,
                letterSpacing:'0.16em', textTransform:'uppercase',
                alignSelf:'flex-start',
              }}>{series.slice(0,3)}</span>}
            </div>)}
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontFamily: FL, fontSize:8, fontWeight:600, letterSpacing:'0.22em', textTransform:'uppercase', color: T.mute }}>Wk Pts</div>
            <div style={{ fontFamily: FB, fontSize:18, fontWeight:600, color: T.ink, marginTop:2, fontVariantNumeric:'tabular-nums' }}>
              {myWkPts != null ? myWkPts : '—'}
            </div>
          </div>
        </>}
      </div>
    </div>
  </>;
}

function LastRaceStrip({ state, me, onNav }) {
  const prevWk = (state.currentWeek || 1) - 1;
  const prev = (state.weeklyResults || []).find(w => w.wk === prevWk);
  if (!prev?.finalized) return null;

  const track = state.schedule.find(s => s.wk === prevWk)?.track || prev.track;
  const ptsMap = prev.pts || {};
  const myPts = ptsMap[me.id] || 0;
  const entries = state.players.map(p => ({ id: p.id, name: p.name, pts: ptsMap[p.id] || 0 }));
  const topPts = Math.max(...entries.map(e => e.pts));
  const winners = entries.filter(e => e.pts === topPts);
  const youWon = winners.some(w => w.id === me.id);

  // Order entries descending to compute your finish position.
  const sorted = [...entries].sort((a, b) => b.pts - a.pts);
  const myRank = sorted.findIndex(e => e.id === me.id) + 1;
  const ord = ordinalSuffix(myRank);

  // Build label
  const winnerName = winners.map(w => w.name).join(' & ');
  const body = youWon
    ? `You won the week (${myPts} pts) 🏆`
    : `You: ${myRank}${ord} (${myPts}) · ${winnerName} won the week (${topPts})`;

  return <>
    <SectionLabel right={<LinkArrow onClick={() => onNav('recap', { wk: prevWk })}>Recap</LinkArrow>}>
      Last Race
    </SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      <button
        onClick={() => onNav('recap', { wk: prevWk })}
        style={{
          appearance:'none', width:'100%', textAlign:'left',
          background: youWon
            ? 'linear-gradient(180deg, #C9A268 0%, #B8935A 100%)'
            : T.card,
          color: youWon ? T.ink : T.ink,
          border: youWon
            ? '1px solid rgba(255,255,255,0.18)'
            : `1px solid ${T.line2}`,
          borderRadius:6, padding:'12px 14px', cursor:'pointer',
          display:'flex', alignItems:'center', gap:12,
        }}>
        <div style={{
          fontFamily: FL, fontSize:9, fontWeight:600,
          letterSpacing:'0.22em', textTransform:'uppercase',
          color: youWon ? 'rgba(20,17,13,0.65)' : T.mute,
          flexShrink:0,
        }}>Wk {String(prevWk).padStart(2,'0')}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily: FD, fontSize:14, fontWeight:600, letterSpacing:'-0.02em', lineHeight:1.1 }}>{track}</div>
          <div style={{ fontFamily: FB, fontSize:12, marginTop:3, lineHeight:1.4 }}>{body}</div>
        </div>
      </button>
    </div>
  </>;
}

// ─── ALL-STAR HERO ───────────────────────────────────────────────
// The All-Star Race is a non-points exhibition. The week has no draft;
// every player has a single locked pick (in `currentRace.allStarPicks`)
// and the only scoring is a 50-pt all-or-nothing bonus to anyone who
// picked the race winner. The hero card needs to look distinctly
// different from a regular Cup week so the league knows the format
// changed — copper accents on the dark ink ground, the picks rendered
// inline as 6 mini badge+car chips, and a "+50 BONUS" callout.
function AllStarHero({ state, me, currentRace, raceLive, resultsDue, isAdmin, onNav }) {
  const picks = currentRace.allStarPicks || {};
  const pool = state.drivers || DEFAULT_DRIVERS;
  const driverFor = (num) =>
    pool.find(d => d.num === num)
    || DEFAULT_DRIVERS.find(d => d.num === num)
    || { num, name: `#${num}`, primary: T.mute, secondary: T.ink };

  const eyebrow = raceLive ? 'Live · All-Star Underway'
    : resultsDue ? 'Race Day · Winner Pending'
    : 'All-Star · Exhibition';

  const status = raceLive ? 'Locked picks — green flag dropped'
    : resultsDue ? (isAdmin ? 'Enter the winner to apply the bonus' : 'Waiting on commissioner')
    : 'Locked picks · 50 pts all-or-nothing';

  return <div style={{ padding:'0 20px 16px' }}>
    <div style={{
      background: T.ink, color: T.bg, borderRadius:4, overflow:'hidden',
      // Distinct copper outline marks the special week without competing
      // with the existing hero typography. 1px keeps it editorial, not flashy.
      border:`1px solid ${T.hot}`,
      boxShadow:'0 8px 24px rgba(184,147,90,0.18)',
      position:'relative',
    }}>
      <div style={{ padding:'20px 20px 18px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
          <span style={{ color: T.hot, fontSize:13, lineHeight:1, transform:'translateY(-1px)' }}>★</span>
          <div style={{
            fontFamily: FL, fontSize:9, fontWeight: raceLive ? 700 : 600,
            letterSpacing:'0.28em', color: T.hot, textTransform:'uppercase',
          }}>{eyebrow}</div>
          <div style={{
            fontFamily: FL, fontSize:9, fontWeight:400, letterSpacing:'0.18em',
            color:'rgba(247,244,237,0.4)', textTransform:'uppercase', marginLeft:'auto',
          }}>Week {String(state.currentWeek).padStart(2,'0')}</div>
        </div>

        <div style={{ fontFamily: FD, fontSize:44, fontWeight:600, lineHeight:0.95, letterSpacing:'-0.03em' }}>
          {currentRace.raceName || 'All-Star Race'}
        </div>
        <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:13, color:'rgba(247,244,237,0.7)', marginTop:6, letterSpacing:'0.01em' }}>
          {currentRace.track}
        </div>

        {/* Bonus rule callout — the whole reason this week looks different */}
        <div style={{
          marginTop:14, padding:'10px 12px',
          background:'rgba(184,147,90,0.10)',
          border:`0.5px solid rgba(184,147,90,0.4)`,
          borderRadius:3,
          display:'flex', alignItems:'baseline', gap:10,
        }}>
          <div style={{ fontFamily: FM, fontSize:18, fontWeight:700, color: T.hot, letterSpacing:'-0.02em' }}>+50</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.22em', textTransform:'uppercase', color: T.hot }}>Bonus</div>
            <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color:'rgba(247,244,237,0.85)', marginTop:2 }}>
              All-or-nothing. Pick the winner, take the points.
            </div>
          </div>
        </div>

        {(currentRace.time || currentRace.network) && <div style={{ marginTop:12 }}>
          <RaceCountdown
            date={currentRace.date}
            time={currentRace.time}
            network={currentRace.network}
            tone="dark"
          />
        </div>}
      </div>

      {/* Locked picks grid — 6 mini chips, one per player */}
      <div style={{
        padding:'14px 16px 16px',
        borderTop:'0.5px solid rgba(247,244,237,0.08)',
        background:'rgba(247,244,237,0.025)',
      }}>
        <div style={{
          fontFamily: FL, fontSize:9, fontWeight:600,
          letterSpacing:'0.24em', textTransform:'uppercase',
          color:'rgba(247,244,237,0.5)', marginBottom:10, paddingLeft:4,
        }}>Locked Picks</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
          {state.players.map(p => {
            const driverNum = picks[p.id];
            const driver = driverNum != null ? driverFor(driverNum) : null;
            const isMe = p.id === me.id;
            return <div key={p.id} style={{
              display:'flex', alignItems:'center', gap:8,
              padding:'7px 9px', borderRadius:3,
              background: isMe ? 'rgba(184,147,90,0.14)' : 'rgba(247,244,237,0.04)',
              border: isMe ? `0.5px solid rgba(184,147,90,0.5)` : `0.5px solid rgba(247,244,237,0.06)`,
              minWidth: 0,
            }}>
              <PlayerBadge player={p} size={22}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{
                  fontFamily: FL, fontSize:8, fontWeight:600,
                  letterSpacing:'0.16em', textTransform:'uppercase',
                  color: isMe ? T.hot : 'rgba(247,244,237,0.55)',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                }}>{isMe ? 'You' : p.name}</div>
                <div style={{
                  fontFamily: FB, fontSize:11, fontWeight:600,
                  color:'rgba(247,244,237,0.95)', marginTop:1,
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                }}>
                  {driver ? <>#{driver.num} {driver.name}</> : <span style={{ color:'rgba(247,244,237,0.4)', fontStyle:'italic' }}>—</span>}
                </div>
              </div>
            </div>;
          })}
        </div>
      </div>

      <div style={{
        padding:'14px 20px',
        borderTop:'0.5px solid rgba(247,244,237,0.08)',
        display:'flex', gap:12, alignItems:'center',
      }}>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily: FL, fontSize:9, letterSpacing:'0.24em', textTransform:'uppercase', color:'rgba(247,244,237,0.4)' }}>Status</div>
          <div style={{ fontFamily: FB, fontSize:13, marginTop:3, color:'rgba(247,244,237,0.85)' }}>{status}</div>
        </div>
        {isAdmin && <button onClick={() => onNav('enter-results')} style={{
          appearance:'none', background:'transparent', color: T.bg,
          border:`0.5px solid ${T.hot}`,
          padding:'9px 16px', borderRadius:3, cursor:'pointer',
          fontFamily: FL, fontWeight:600, fontSize:10,
          letterSpacing:'0.2em', textTransform:'uppercase', color: T.hot,
        }}>{resultsDue || raceLive ? 'Enter Winner →' : 'Set Winner'}</button>}
      </div>
    </div>
  </div>;
}

function RaceQuote({ state }) {
  const wk = state.currentWeek || 1;
  const quote = RACE_QUOTES[(wk - 1) % RACE_QUOTES.length];
  if (!quote) return null;
  return <div style={{ padding:'10px 20px 28px' }}>
    <div style={{
      background: T.card, border:`1px solid ${T.line2}`, borderRadius:6,
      padding:'18px 20px 20px', position:'relative',
    }}>
      <span style={{
        position:'absolute', top:6, left:14,
        fontFamily: FI, fontStyle:'italic', fontSize:48,
        color: 'rgba(184,147,90,0.35)', lineHeight:1,
      }}>“</span>
      <div style={{
        fontFamily: FI, fontStyle:'italic', fontSize:15,
        color: T.ink, lineHeight:1.5, letterSpacing:'0.005em',
        paddingLeft:24,
      }}>{quote.text}</div>
      <div style={{
        fontFamily: FL, fontSize:10, fontWeight:600,
        letterSpacing:'0.22em', textTransform:'uppercase',
        color: T.hot, marginTop:12, paddingLeft:24,
      }}>— {quote.speaker}</div>
      {quote.context && <div style={{
        fontFamily: FI, fontStyle:'italic', fontSize:11,
        color: T.mute, marginTop:3, paddingLeft:24,
      }}>{quote.context}</div>}
    </div>
  </div>;
}

export default function HomeScreen({ state, me, onNav, currentRace: rawCurrentRace, driverStats, standings }) {
  const { players, schedule, currentWeek, weeklyResults, draftState } = state;
  // After Wk 36 is finalized, currentWeek can advance past the schedule.
  // The parent passes null in that case; here we fall back to the final
  // race entry (or a synthetic off-season placeholder) so the hero card
  // still has something to render.
  const seasonOver = !rawCurrentRace;
  const currentRace = rawCurrentRace
    || schedule[schedule.length - 1]
    || { track: 'Off-season', type: '—', len: 0, laps: 0, date: '', time: '', network: '' };
  const sorted = [...standings].sort((a,b) => b.seasonPts - a.seasonPts);
  const rank = sorted.findIndex(s => s.id === me.id) + 1;
  const meStanding = standings.find(s => s.id === me.id);
  const upcoming = schedule.filter(s => s.wk > currentWeek).slice(0, 2);

  const isAllStar = currentRace.format === 'all-star';
  const phase = draftState?.phase || 'not-started';
  const cfg = getWeekConfig(state, currentWeek);
  const totalPicks = cfg.totalPicks * players.length;
  const pickCount = draftState?.picks?.length || 0;
  // All-Star weeks have no draft — the picks are pre-locked on the
  // schedule entry, so treat the draft as "complete" for status logic.
  const draftComplete = isAllStar || phase === 'done' || pickCount >= totalPicks;

  // Detect "results due": draft for this week is done but no finalized result yet.
  const thisWeekResult = weeklyResults.find(w => w.wk === currentWeek);
  const resultsDue = draftComplete && !thisWeekResult?.finalized;
  const isAdmin = me.id === ADMIN_ID;

  // Live race state — live if green flag is within ~4hr ago. Used to surface
  // a pulsing "LIVE" pill on the hero so the league can feel race day in real time.
  const cd = raceCountdown(currentRace.date, currentRace.time);
  const raceLive = cd?.status === 'live';

  const statusLine = () => {
    if (phase === 'not-started') return 'Tap to start draft';
    if (phase === 'slot-pick') return `Pick-your-slot · ${draftState.slotPickIdx + 1}/${players.length}`;
    if (phase === 'ready') return 'Slots locked · waiting to start';
    if (phase === 'snake' && !draftComplete) return `Round ${draftState.currentRound} · pick ${pickCount + 1} of ${totalPicks}`;
    if (resultsDue) return isAdmin ? 'Results due — tap to enter Cup points' : 'Waiting on commissioner to enter results';
    if (draftComplete) return 'Roster set · enter results when race finishes';
    return 'Ready';
  };

  const ctaLabel = resultsDue
    ? (isAdmin ? 'Enter Results →' : 'View Status')
    : draftComplete
      ? 'Enter Results'
      : phase === 'not-started'
        ? 'Begin'
        : 'Enter';
  const ctaTarget = resultsDue
    ? 'enter-results'
    : draftComplete
      ? 'enter-results'
      : (phase === 'slot-pick' || phase === 'not-started')
        ? 'slot'
        : 'draft';

  return <div style={{ paddingBottom: 20 }}>
    <TopBar
      subtitle={`Week ${String(currentWeek).padStart(2,'0')} · ${currentRace.date}`}
      title="Harvest Moon"
      right={<button onClick={() => onNav('profile')} style={{
        appearance:'none', border:`0.5px solid ${T.line}`, background: T.card,
        width:36, height:36, borderRadius:18, padding:0, cursor:'pointer',
        fontFamily: FL, fontWeight:500, fontSize:12, color: T.ink,
      }}>{me.initial}</button>}
    />

    <InstallHint />

    {/* "Results due" callout — shows above the hero only when this is the
        admin's pending action, so it grabs attention. Non-admins still see
        the inline status note in the hero card below. Suppressed on All-Star
        weeks because the dedicated hero already prompts admin action. */}
    {resultsDue && isAdmin && !isAllStar && <div style={{ padding:'0 20px 14px' }}>
      <button onClick={() => onNav('enter-results')} style={{
        appearance:'none', width:'100%', textAlign:'left',
        background: T.copperGradient,
        color: T.ink, border:'1px solid rgba(255,255,255,0.18)',
        borderRadius:8, padding:'14px 16px', cursor:'pointer',
        boxShadow:'inset 0 1px 0 rgba(255,255,255,0.4), 0 6px 20px rgba(20,17,13,0.2)',
        display:'flex', alignItems:'center', gap:14,
      }}>
        <div style={{
          fontSize:24, lineHeight:1, animation:'pulse 1.6s ease-in-out infinite',
        }}>🏁</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.24em', textTransform:'uppercase' }}>Results Due</div>
          <div style={{ fontFamily: FD, fontSize:16, fontWeight:600, letterSpacing:'-0.02em', marginTop:2 }}>
            {currentRace.track} is in the books — enter Cup points
          </div>
        </div>
        <div style={{ fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.22em', textTransform:'uppercase', flexShrink:0 }}>Go →</div>
      </button>
    </div>}

    {/* Hero card: All-Star weeks get a dedicated treatment so the format
        change is unmistakable; everything else uses the standard race hero. */}
    {isAllStar
      ? <AllStarHero state={state} me={me} currentRace={currentRace} raceLive={raceLive} resultsDue={resultsDue} isAdmin={isAdmin} onNav={onNav}/>
      : <div style={{ padding:'0 20px 16px' }}>
      <div style={{ background: T.ink, color: T.bg, borderRadius:4, overflow:'hidden', position:'relative' }}>
        <div style={{ padding:'20px 20px 18px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <div style={{
              width: raceLive ? 7 : 5, height: raceLive ? 7 : 5, borderRadius:'50%',
              background: T.hot,
              animation: raceLive ? 'pulse 1.6s ease-in-out infinite' : 'none',
            }}/>
            <div style={{ fontFamily: FL, fontSize:9, fontWeight: raceLive ? 700 : 500, letterSpacing:'0.24em', color: T.hot, textTransform:'uppercase' }}>
              {raceLive
                ? 'Live · Race Underway'
                : resultsDue ? 'Race Day · Results Due'
                : draftComplete ? 'Race Day'
                : 'Drafting Now'}
            </div>
            <div style={{ fontFamily: FL, fontSize:9, fontWeight:400, letterSpacing:'0.18em', color:'rgba(247,244,237,0.4)', textTransform:'uppercase', marginLeft:'auto' }}>
              Week {String(currentWeek).padStart(2,'0')}
            </div>
          </div>
          <div style={{ fontFamily: FD, fontSize:44, fontWeight:600, lineHeight:0.95, letterSpacing:'-0.03em' }}>
            {currentRace.raceName || currentRace.track}
          </div>
          <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:13, color:'rgba(247,244,237,0.7)', marginTop:6, letterSpacing:'0.01em' }}>
            {currentRace.track}
          </div>
          <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color:'rgba(247,244,237,0.45)', marginTop:4, letterSpacing:'0.01em' }}>
            {currentRace.type} · {currentRace.len} mi · {currentRace.laps} laps
          </div>
          {(currentRace.time || currentRace.network) && <div style={{ marginTop:12 }}>
            <RaceCountdown
              date={currentRace.date}
              time={currentRace.time}
              network={currentRace.network}
              tone="dark"
            />
          </div>}
          {currentRace.lastWinner && <div style={{
            marginTop:10, paddingTop:10,
            borderTop:'0.5px solid rgba(247,244,237,0.08)',
            fontFamily: FL, fontSize:9, fontWeight:500,
            letterSpacing:'0.22em', textTransform:'uppercase',
            color:'rgba(247,244,237,0.4)',
          }}>
            2025 Winner · <span style={{ fontFamily: FB, fontSize:12, fontWeight:600, letterSpacing:'-0.005em', textTransform:'none', color:'rgba(247,244,237,0.85)' }}>{currentRace.lastWinner}</span>
          </div>}
        </div>
        <div style={{ padding:'14px 20px', borderTop:'0.5px solid rgba(247,244,237,0.08)', display:'flex', gap:12, alignItems:'center' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily: FL, fontSize:9, letterSpacing:'0.24em', textTransform:'uppercase', color:'rgba(247,244,237,0.4)' }}>Status</div>
            <div style={{ fontFamily: FB, fontSize:13, marginTop:3, color:'rgba(247,244,237,0.85)' }}>{statusLine()}</div>
          </div>
          <button onClick={() => onNav(ctaTarget)} style={{
            appearance:'none', background:'transparent', color: T.bg,
            border:'0.5px solid rgba(247,244,237,0.3)',
            padding:'9px 16px', borderRadius:3, cursor:'pointer',
            fontFamily: FL, fontWeight:500, fontSize:10,
            letterSpacing:'0.2em', textTransform:'uppercase',
          }}>{ctaLabel}</button>
        </div>
      </div>
    </div>}

    {/* Your standing */}
    <div style={{ padding:'0 20px 20px' }}>
      <div style={{
        borderTop:`0.5px solid ${T.line}`, borderBottom:`0.5px solid ${T.line}`,
        padding:'18px 2px', display:'flex', alignItems:'center', gap:16,
      }}>
        <div style={{ fontFamily: FD, fontSize:56, fontWeight:600, lineHeight:1, letterSpacing:'-0.03em', color: T.ink, display:'flex', alignItems:'baseline' }}>
          <span>{rank}</span>
          <span style={{ fontSize:18, color: T.mute, fontStyle:'italic', marginLeft:2 }}>{ordinalSuffix(rank)}</span>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily: FL, fontSize:9, letterSpacing:'0.24em', textTransform:'uppercase', color: T.mute }}>Your Standing</div>
          <div style={{ fontFamily: FB, fontSize:13, color: T.ink2, marginTop:4, fontVariantNumeric:'tabular-nums' }}>
            {meStanding.seasonPts.toLocaleString()} pts · {rank === 1
              ? `${meStanding.wins} weekly ${meStanding.wins === 1 ? 'win' : 'wins'}`
              : `−${(sorted[0].seasonPts - meStanding.seasonPts).toLocaleString()} back of ${sorted[0].name}`}
          </div>
        </div>
        <LinkArrow onClick={() => onNav('standings')}>View</LinkArrow>
      </div>
    </div>

    <StatOfTheSeason state={state} driverStats={driverStats} onNav={onNav}/>

    {/* Roster strip is for the regular Cup draft. All-Star picks already
        appear inline on the dedicated hero — no need to repeat them here. */}
    {!isAllStar && <YourRosterStrip state={state} me={me} onNav={onNav}/>}

    <LastRaceStrip state={state} me={me} onNav={onNav}/>

    {/* Upcoming */}
    {upcoming.length > 0 && <>
      <SectionLabel right={<LinkArrow onClick={() => onNav('schedule')}>All</LinkArrow>}>Upcoming</SectionLabel>
      <div style={{ padding:'14px 20px 20px' }}>
        {upcoming.map((race, i, arr) => (
          <div key={race.wk} style={{
            padding:'14px 0',
            borderBottom: i === arr.length-1 ? 'none' : `0.5px solid ${T.line2}`,
            display:'flex', alignItems:'center', gap:14,
          }}>
            <div style={{ fontFamily: FL, fontSize:10, fontWeight:500, letterSpacing:'0.2em', textTransform:'uppercase', color: T.mute, width:56 }}>Wk {String(race.wk).padStart(2,'0')}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1.1 }}>{race.raceName || race.track}</div>
              <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute, marginTop:3 }}>
                {race.raceName ? `${race.track} · ` : ''}{race.date}{race.time ? ` · ${race.time}` : ''}{race.network ? ` · ${race.network}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>}

    <RaceQuote state={state}/>
  </div>;
}
