'use client';
import React from 'react';
import { PlayerBadge, RaceCountdown, SectionLabel, TopBar, WinsCount } from '@/components/ui/primitives';
import { InstallHint } from '@/components/ui/InstallHint';
import { ADMIN_ID, FB, FD, FI, FL, T } from '@/lib/constants';
import { computeStandings, getWeekConfig, ordinalSuffix, raceCountdown } from '@/lib/utils';

export default function HomeScreen({ state, me, onNav }) {
  const { players, schedule, currentWeek, weeklyResults, draftState } = state;
  // After Wk 36 is finalized, currentWeek can advance to 37+ until reset. Show
  // the last race in the schedule rather than blowing up.
  const currentRace = schedule.find(s => s.wk === currentWeek)
    || schedule[schedule.length - 1]
    || { track: 'Off-season', type: '—', len: 0, laps: 0, date: '', time: '', network: '' };
  const seasonOver = !schedule.find(s => s.wk === currentWeek);
  const standings = computeStandings(players, weeklyResults, currentWeek - 1);
  const sorted = [...standings].sort((a,b) => b.seasonPts - a.seasonPts);
  const rank = sorted.findIndex(s => s.id === me.id) + 1;
  const meStanding = standings.find(s => s.id === me.id);
  const top3 = sorted.slice(0, 3);
  const upcoming = schedule.filter(s => s.wk > currentWeek).slice(0, 2);

  const phase = draftState?.phase || 'not-started';
  const cfg = getWeekConfig(state, currentWeek);
  const totalPicks = cfg.totalPicks * players.length;
  const pickCount = draftState?.picks?.length || 0;
  const draftComplete = phase === 'done' || pickCount >= totalPicks;

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
        the inline status note in the hero card below. */}
    {resultsDue && isAdmin && <div style={{ padding:'0 20px 14px' }}>
      <button onClick={() => onNav('enter-results')} style={{
        appearance:'none', width:'100%', textAlign:'left',
        background:'linear-gradient(180deg, #C9A268 0%, #B8935A 50%, #9A7A48 100%)',
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

    {/* Hero card: this week's race */}
    <div style={{ padding:'0 20px 16px' }}>
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
    </div>

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
        <button onClick={() => onNav('standings')} style={{
          appearance:'none', border:'none', background:'transparent',
          padding:0, cursor:'pointer', color: T.ink,
          fontFamily: FI, fontStyle:'italic', fontSize:14,
        }}>View →</button>
      </div>
    </div>

    {/* Leaderboard top 3 */}
    <SectionLabel right={<span onClick={() => onNav('standings')} style={{ cursor:'pointer', fontFamily: FI, fontStyle:'italic', fontSize:12, letterSpacing:'0.01em', textTransform:'none', color: T.ink }}>All →</span>}>Leaderboard</SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      {weeklyResults.length === 0 ? (
        <div style={{ padding:'18px 0', fontFamily: FI, fontStyle:'italic', fontSize:13, color: T.mute, lineHeight:1.5 }}>
          Standings open at 0 — finish the first race and the leaderboard fills in.
        </div>
      ) : top3.map((p, i) => {
        const isMe = p.id === me.id;
        return <div key={p.id} style={{
          padding:'14px 0 14px 12px',
          marginLeft: -12,
          borderBottom: i === top3.length-1 ? 'none' : `0.5px solid ${T.line2}`,
          borderLeft: isMe ? `2px solid ${T.hot}` : '2px solid transparent',
          display:'flex', alignItems:'center', gap:14,
        }}>
          <div style={{ fontFamily: FD, fontSize:20, fontWeight:600, width:22, color: T.ink, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>0{i+1}</div>
          <PlayerBadge player={p} size={26}/>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, minWidth:0, flexWrap:'wrap' }}>
            <span style={{ fontFamily: FD, fontSize:20, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1 }}>{p.name}</span>
            {isMe && <span style={{
              fontFamily: FL, fontSize:8, fontWeight:700,
              letterSpacing:'0.22em', textTransform:'uppercase',
              color: T.hot,
              padding:'2px 6px',
              border:`1px solid ${T.hot}`, borderRadius:2,
            }}>You</span>}
            <WinsCount wins={p.wins} compact/>
          </div>
          <div style={{ fontFamily: FB, fontSize:14, fontWeight:500, color: T.ink, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.01em' }}>{p.seasonPts.toLocaleString()}</div>
        </div>;
      })}
    </div>

    {/* Upcoming */}
    {upcoming.length > 0 && <>
      <SectionLabel>Upcoming</SectionLabel>
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
  </div>;
}
