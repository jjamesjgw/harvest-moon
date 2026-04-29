'use client';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { BackChip, CarNum, PlayerBadge, SectionLabel, TopBar } from '@/components/ui/primitives';
import { FB, FD, FI, FL, ROUNDS_PER_WEEK, SERIES, T } from '@/lib/constants';
import { DEFAULT_DRIVERS } from '@/lib/data';
import {
  buildSnakeOrder, computeAllDriverStats, countPicksBySeries, getBonusPool,
  getWeekConfig,
} from '@/lib/utils';

// Helper: a stable composite key per pick "this driver in this series".
// Bonus pools can share numbers with Cup drivers (e.g. #7 Heim runs Cup AND
// Truck), so we can't dedupe by num alone — series + num together are unique.
const pickKey = (series, num) => `${series}:${num}`;

export default function DraftScreen({ state, setState, me, onNav }) {
  const { players, schedule, currentWeek, draftState, adminId, weekDriversExtra = {} } = state;
  const currentRace = schedule.find(s => s.wk === currentWeek);
  const isAdmin = me.id === adminId;
  const [resetArm, setResetArm] = useState(false);

  // Resolve this week's draft shape from config (allotments per series + total rounds).
  const cfg = getWeekConfig(state, currentWeek);
  const totalPicks = cfg.totalPicks * 1; // rounds = total per-player picks
  const totalDraftPicks = cfg.totalPicks * players.length;

  // Cup driver pool (default 36 + this week's one-offs from Manage Drivers).
  const cupDrivers = useMemo(() => {
    const wkExtras = (weekDriversExtra || {})[currentWeek] || [];
    return [...DEFAULT_DRIVERS, ...wkExtras];
  }, [weekDriversExtra, currentWeek]);

  // Decision-support stats for each driver — total picks, avg pts/draft,
  // and the last 3 race scores when drafted. Drives the small stat block
  // beneath each driver's name in the pool grid. Computed once per state
  // change and reused per-card via Map lookup.
  const driverStats = useMemo(() => {
    const all = computeAllDriverStats(state);
    return new Map(all.drivers.map(d => [d.num, d]));
  }, [state]);

  // Freshly-arrived picks. Whenever the picks array grows (whether from
  // realtime push or local action), the new entries get added to a Set
  // and rendered with a transient ring + tag-slide animation. Cleared
  // ~1.2s later. Undo (picks shrinks) doesn't trigger animations and
  // should reset our seen-set so a re-pick of the same driver after undo
  // will animate again. Keys are series+num so bonus and Cup picks of
  // the same number stay distinct.
  const seenPicksRef = useRef(new Set());
  const [freshPickKeys, setFreshPickKeys] = useState(() => new Set());
  useEffect(() => {
    const currentKeys = new Set(
      (draftState.picks || []).map(p => pickKey(p.series || 'Cup', p.driverNum))
    );
    // If picks shrank (undo) or reset, drop seen-keys that no longer exist
    // so they can re-animate when re-picked.
    seenPicksRef.current.forEach(k => {
      if (!currentKeys.has(k)) seenPicksRef.current.delete(k);
    });
    // Find newcomers.
    const newKeys = [];
    currentKeys.forEach(k => {
      if (!seenPicksRef.current.has(k)) {
        seenPicksRef.current.add(k);
        newKeys.push(k);
      }
    });
    if (newKeys.length === 0) return;
    setFreshPickKeys(prev => {
      const next = new Set(prev);
      newKeys.forEach(k => next.add(k));
      return next;
    });
    const t = setTimeout(() => {
      setFreshPickKeys(prev => {
        const next = new Set(prev);
        newKeys.forEach(k => next.delete(k));
        return next;
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [draftState.picks]);

  const resetDraft = () => {
    if (!resetArm) { setResetArm(true); setTimeout(() => setResetArm(false), 3000); return; }
    setState(s => ({
      ...s,
      draftState: { phase:'slot-pick', slotPickIdx:0, slotAssign:{}, currentRound:1, picks:[] },
    }));
    setResetArm(false);
    onNav('slot');
  };

  // The snake order is now `cfg.totalPicks` rounds long (was hardcoded ROUNDS_PER_WEEK).
  const snakeOrder = buildSnakeOrder(players, draftState.slotAssign, cfg.totalPicks);
  const pickIdx = draftState.picks.length;
  const done = pickIdx >= totalDraftPicks;
  const onClock = done ? null : snakeOrder[pickIdx];
  const currentPicker = onClock ? players.find(p => p.id === onClock.playerId) : null;
  const myTurn = currentPicker && currentPicker.id === me.id;
  const canPick = onClock && (onClock.playerId === me.id || isAdmin);

  // Track picks as series-scoped to allow same driver number across series.
  const pickedKeys = useMemo(
    () => new Set(draftState.picks.map(p => pickKey(p.series || 'Cup', p.driverNum))),
    [draftState.picks]
  );

  // Which series tab is currently selected. Defaults to first available
  // series for the current picker.
  const pickerId = onClock?.playerId;
  const remainingForPicker = (s) => {
    if (!pickerId) return 0;
    const used = countPicksBySeries(draftState.picks, pickerId, s);
    return (cfg.allotments[s] || 0) - used;
  };
  const orderedSeries = Object.keys(cfg.allotments); // Cup first, then bonus order from config
  const defaultSeries = orderedSeries.find(s => remainingForPicker(s) > 0) || 'Cup';
  const [activeSeries, setActiveSeries] = useState(defaultSeries);

  // Reset the active series tab to Cup whenever the picker changes — keeps
  // the next person from inheriting the previous picker's tab choice. If
  // Cup is already maxed for them (rare — only at the tail of a non-bonus
  // week pure-Cup snake), fall through to the next available series.
  useEffect(() => {
    if (!pickerId) return;
    const cupRemaining = remainingForPicker('Cup');
    if (cupRemaining > 0) {
      setActiveSeries('Cup');
      return;
    }
    const nextAvailable = orderedSeries.find(s => remainingForPicker(s) > 0);
    if (nextAvailable) setActiveSeries(nextAvailable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerId]);

  // Within a single picker's turn — if they hit the max in the active series
  // (e.g. fourth Cup pick locks Cup), auto-snap to the next available bucket.
  useEffect(() => {
    if (remainingForPicker(activeSeries) <= 0) {
      const nextAvailable = orderedSeries.find(s => remainingForPicker(s) > 0);
      if (nextAvailable) setActiveSeries(nextAvailable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftState.picks.length]);

  // Resolve driver pool for the active series.
  const activePool = activeSeries === 'Cup' ? cupDrivers : getBonusPool(state, currentWeek, activeSeries);

  // Pick action — locks the driver into the current pick slot.
  const pick = (driver) => {
    if (done || !onClock || !canPick) return;
    if (pickedKeys.has(pickKey(activeSeries, driver.num))) return;
    if (remainingForPicker(activeSeries) <= 0) return;
    const newPicks = [...draftState.picks, {
      driverNum: driver.num,
      driverName: driver.name, // snapshot for history when bonus drivers go away later
      series: activeSeries,
      playerId: onClock.playerId,
      round: onClock.round,
      slot: onClock.slot,
      at: Date.now(),
    }];
    const completing = newPicks.length >= totalDraftPicks;
    const nextRound = snakeOrder[newPicks.length]?.round || cfg.totalPicks;
    setState(s => ({
      ...s,
      draftState: {
        ...s.draftState,
        picks: newPicks,
        currentRound: nextRound,
        phase: completing ? 'done' : 'snake',
      }
    }));
  };

  const undo = () => {
    if (pickIdx === 0) return;
    const newPicks = draftState.picks.slice(0, -1);
    setState(s => ({
      ...s,
      draftState: { ...s.draftState, picks: newPicks, phase: 'snake' }
    }));
  };

  return <div style={{ paddingBottom:20, display:'flex', flexDirection:'column', minHeight:'100%' }}>
    <div style={{ position:'sticky', top:0, zIndex:5, background: T.bg, paddingBottom:10 }}>
      <TopBar
        subtitle={`${currentRace?.track || ''} · Wk ${String(currentWeek).padStart(2,'0')}`}
        title="Draft"
        right={<BackChip onClick={() => onNav('home')} label="Exit"/>}
      />
      <div style={{ padding:'0 20px 4px' }}>
        <OnTheClock
          currentPicker={currentPicker}
          pickIdx={pickIdx}
          totalPicks={totalDraftPicks}
          round={onClock?.round}
          totalRounds={cfg.totalPicks}
          myTurn={myTurn}
          done={done}
        />
      </div>

      {!done && cfg.bonusSeries.length > 0 && currentPicker && <SeriesTabs
        cfg={cfg}
        picks={draftState.picks}
        pickerId={currentPicker.id}
        active={activeSeries}
        onSelect={setActiveSeries}
        bonusPools={state.bonusDriversByWeek?.[currentWeek] || {}}
      />}

      {!done && <div style={{ padding:'10px 20px 0', display:'flex', gap:6, justifyContent:'flex-end' }}>
        {pickIdx > 0 && (() => {
          const lastPick = draftState.picks[draftState.picks.length - 1];
          const canUndo = lastPick && (lastPick.playerId === me.id || isAdmin);
          if (!canUndo) return null;
          return <button onClick={undo} style={{
            appearance:'none',
            background: T.ink, color: T.bg,
            border:'none',
            padding:'8px 14px', borderRadius:3, cursor:'pointer',
            fontFamily: FL, fontSize:10, fontWeight:600,
            letterSpacing:'0.2em', textTransform:'uppercase',
          }}>↶ Undo my pick</button>;
        })()}
        {isAdmin && (pickIdx > 0 || Object.keys(draftState.slotAssign).length > 0) && <button onClick={resetDraft} style={{
          appearance:'none',
          background: T.hot, color: T.ink,
          border:'none',
          padding:'8px 14px', borderRadius:3, cursor:'pointer',
          fontFamily: FL, fontSize:10, fontWeight:600,
          letterSpacing:'0.2em', textTransform:'uppercase',
        }}>{resetArm ? 'Tap to confirm' : 'Reset'}</button>}
      </div>}
    </div>

    {!done && <DraftGrid
      drivers={activePool}
      pickedKeys={pickedKeys}
      activeSeries={activeSeries}
      draftState={draftState}
      players={players}
      onPick={pick}
      myTurn={myTurn}
      remaining={remainingForPicker(activeSeries)}
      isEmpty={activePool.length === 0}
      isAdmin={isAdmin}
      onAddDriver={() => onNav('manage-drivers')}
      driverStats={driverStats}
      freshPickKeys={freshPickKeys}
    />}
    {!done && activeSeries === 'Cup' && isAdmin && <div style={{ padding:'0 20px 24px' }}>
      <button onClick={() => onNav('manage-drivers')} style={{
        appearance:'none', width:'100%',
        background: T.ink, color: T.bg,
        border:'none', borderRadius:3,
        padding:'14px',
        fontFamily: FL, fontSize:10, fontWeight:600,
        letterSpacing:'0.22em', textTransform:'uppercase',
        cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'center', gap:8,
      }}>
        <span style={{ fontSize:16, lineHeight:1, fontFamily: FD, fontWeight:300 }}>+</span>
        Add Cup Driver
      </button>
    </div>}

    {done && <DraftComplete state={state} onNav={onNav} cupDrivers={cupDrivers} />}
  </div>;
}

// ── Header banner: who's on the clock + pick count ─────────────────
function OnTheClock({ currentPicker, pickIdx, totalPicks, round, totalRounds, myTurn, done }) {
  if (done) return <div style={{ background: T.good, color:'#fff', borderRadius:4, padding:'16px 18px' }}>
    <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.24em', textTransform:'uppercase', color:'rgba(255,255,255,0.75)' }}>Draft Complete</div>
    <div style={{ fontFamily: FD, fontSize:24, fontWeight:600, letterSpacing:'-0.03em', marginTop:2 }}>Roll out the green flag</div>
  </div>;
  if (!currentPicker) return null;
  return <div style={{
    background: T.ink, color: T.bg, borderRadius:4, padding:'14px 18px',
    display:'flex', alignItems:'center', gap:14,
    border: myTurn ? `2px solid ${T.hot}` : 'none',
  }}>
    <PlayerBadge player={currentPicker} size={36}/>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.24em', textTransform:'uppercase', color: myTurn ? T.hot : 'rgba(247,244,237,0.5)' }}>
        {myTurn ? "You're up" : 'On the Clock'} · Round {round}/{totalRounds}
      </div>
      <div style={{ fontFamily: FD, fontSize:22, fontWeight:600, lineHeight:1.05, letterSpacing:'-0.03em', marginTop:2 }}>{currentPicker.name}</div>
    </div>
    <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:13, color:'rgba(247,244,237,0.55)', fontVariantNumeric:'tabular-nums' }}>{pickIdx+1}/{totalPicks}</div>
  </div>;
}

// ── Series tab strip ───────────────────────────────────────────────
// Shown only on weeks with bonus rounds. Each tab displays "Cup 2/4"
// where 2 is picks-used by the current picker and 4 is their allotment.
// Tabs that are maxed are disabled. Tabs whose pool is empty get a hint.
function SeriesTabs({ cfg, picks, pickerId, active, onSelect, bonusPools }) {
  return <div style={{ padding:'10px 20px 0' }}>
    <div style={{
      display:'flex', gap:6, overflowX:'auto', paddingBottom:6,
    }}>
      {Object.entries(cfg.allotments).map(([series, max]) => {
        const used = countPicksBySeries(picks, pickerId, series);
        const remaining = max - used;
        const pool = series === 'Cup' ? null : (bonusPools[series] || []);
        const poolEmpty = pool && pool.length === 0;
        const disabled = remaining <= 0 || poolEmpty;
        const isActive = active === series;
        const meta = SERIES[series] || { label: series, short: series.slice(0,3).toUpperCase() };
        return <button
          key={series}
          onClick={() => !disabled && onSelect(series)}
          disabled={disabled}
          style={{
            appearance:'none', flexShrink:0,
            padding:'8px 14px',
            background: isActive ? T.ink : (disabled ? T.bg2 : T.card),
            color: isActive ? T.bg : (disabled ? T.mute : T.ink),
            border:`1px solid ${isActive ? T.ink : T.line}`,
            borderRadius:3,
            cursor: disabled ? 'default' : 'pointer',
            fontFamily: FL, fontSize:10, fontWeight:600,
            letterSpacing:'0.18em', textTransform:'uppercase',
            display:'flex', alignItems:'center', gap:8,
            opacity: disabled ? 0.55 : 1,
          }}
          title={poolEmpty ? 'Admin has not added drivers for this series yet' : undefined}
        >
          <span>{meta.label}</span>
          <span style={{ fontFamily: FB, fontSize:11, fontWeight:600, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.01em', color: isActive ? T.hot : T.mute }}>{used}/{max}</span>
        </button>;
      })}
    </div>
  </div>;
}

// ── Driver pool grid ───────────────────────────────────────────────
function DraftGrid({ drivers, pickedKeys, activeSeries, draftState, players, onPick, remaining, isEmpty, isAdmin, onAddDriver, driverStats, freshPickKeys }) {
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
          const takenBy = taken ? draftState.picks.find(p => p.driverNum === d.num && (p.series || 'Cup') === activeSeries) : null;
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
              : 'linear-gradient(180deg, #FEFCF7 0%, #F5F1E5 100%)',
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
            <CarNum driver={d} size={48}/>
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
                fontFamily: FM, fontSize:9, color: T.mute,
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

// ── Draft-complete summary roster view ─────────────────────────────
// Now groups picks by series so bonus drivers are visually distinct from
// Cup picks. Each player shows "Cup [4 chips] · Truck [1 chip] · ..."
function DraftComplete({ state, onNav, cupDrivers }) {
  const { players, draftState, currentWeek, bonusDriversByWeek = {} } = state;
  const cfg = getWeekConfig(state, currentWeek);
  const bonusPools = bonusDriversByWeek[currentWeek] || {};
  const lookupDriver = (series, num) => {
    if (series === 'Cup') return cupDrivers.find(d => d.num === num);
    return (bonusPools[series] || []).find(d => d.num === num);
  };

  return <div style={{ padding:'14px 20px 24px' }}>
    <SectionLabel>All Rosters</SectionLabel>
    <div style={{ marginTop:14 }}>
      {players.map((p, i) => {
        const myPicks = draftState.picks.filter(pk => pk.playerId === p.id);
        return <div key={p.id} style={{
          padding:'14px 0',
          borderBottom: i === players.length-1 ? 'none' : `0.5px solid ${T.line2}`,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <PlayerBadge player={p} size={22}/>
            <span style={{ fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em' }}>{p.name}</span>
          </div>
          {Object.keys(cfg.allotments).map(series => {
            const seriesPicks = myPicks.filter(pk => (pk.series || 'Cup') === series);
            if (seriesPicks.length === 0) return null;
            const meta = SERIES[series] || { label: series };
            return <div key={series} style={{ marginBottom:8 }}>
              {series !== 'Cup' && <div style={{
                fontFamily: FL, fontSize:8, fontWeight:600,
                letterSpacing:'0.22em', textTransform:'uppercase',
                color: T.hot, marginBottom:4,
              }}>{meta.label}</div>}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {seriesPicks.map(pk => {
                  const d = lookupDriver(series, pk.driverNum);
                  return d
                    ? <CarNum key={`${series}:${pk.driverNum}`} driver={d} size={32}/>
                    : <div key={`${series}:${pk.driverNum}`} style={{
                        width:32, height:32, borderRadius:4,
                        background: T.bg2, color: T.mute,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontFamily: FB, fontSize:11, fontWeight:600,
                      }}>#{pk.driverNum}</div>;
                })}
              </div>
            </div>;
          })}
        </div>;
      })}
    </div>
    <div style={{ display:'flex', gap:8, marginTop:18 }}>
      <button onClick={() => onNav('team')} style={{
        appearance:'none', flex:1, padding:14,
        background: T.hot, color: T.ink,
        border:'none', borderRadius:3, cursor:'pointer',
        fontFamily: FL, fontSize:11, fontWeight:600,
        letterSpacing:'0.22em', textTransform:'uppercase',
      }}>My Team</button>
      <button onClick={() => onNav('enter-results')} style={{
        appearance:'none', flex:1, padding:14,
        background: T.ink, color: T.bg, border:'none', borderRadius:3, cursor:'pointer',
        fontFamily: FL, fontSize:11, fontWeight:600,
        letterSpacing:'0.22em', textTransform:'uppercase',
      }}>Enter Results →</button>
    </div>
  </div>;
}
