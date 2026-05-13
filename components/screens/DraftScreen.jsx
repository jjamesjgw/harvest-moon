'use client';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { AllStarDraftPaused, BackChip, CarNum, PlayerBadge, SectionLabel, TopBar } from '@/components/ui/primitives';
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
  // All-Star weeks suspend the snake draft. We MUST evaluate the all-star
  // branch only AFTER all hooks below have been called — early-returning
  // here would make the hook count vary between renders, which React
  // forbids. Compute the flag, run every hook normally, then short-circuit
  // at the JSX return.
  const isAllStar = currentRace?.format === 'all-star';
  const isAdmin = me.id === adminId;
  const [resetArm, setResetArm] = useState(false);

  // View mode for the draft screen body. 'pick' = the existing driver pool
  // grid (used to make a selection). 'board' = a full snake grid showing
  // every pick so far, useful for spectators following along without
  // losing place. The toggle only appears once at least one pick exists,
  // and we revert to 'pick' if picks drain to zero (e.g. admin reset).
  const [mode, setMode] = useState('pick');

  // Resolve this week's draft shape from config (allotments per series + total rounds).
  const cfg = getWeekConfig(state, currentWeek);
  const totalPicks = cfg.totalPicks * 1; // rounds = total per-player picks
  const totalDraftPicks = cfg.totalPicks * players.length;

  // Cup driver pool (default 36 + this week's one-offs from Manage Drivers).
  const cupDrivers = useMemo(() => {
    const wkExtras = (weekDriversExtra || {})[currentWeek] || [];
    return [...DEFAULT_DRIVERS, ...wkExtras];
  }, [weekDriversExtra, currentWeek]);

  // Series-aware driver lookup. Cup numbers can collide with bonus-pool
  // numbers (e.g. #7 in Cup vs #7 in Truck), so dispatch by series before
  // searching. Used by the latest-picks strip and the draft board to render
  // historical picks correctly across series.
  const lookupDriver = useMemo(() => {
    const bonusPools = state.bonusDriversByWeek?.[currentWeek] || {};
    return (series, num) => {
      const s = series || 'Cup';
      if (s === 'Cup') return cupDrivers.find(d => d.num === num);
      return (bonusPools[s] || []).find(d => d.num === num);
    };
  }, [cupDrivers, state.bonusDriversByWeek, currentWeek]);

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

  // Auto-revert to Pick mode if picks drain to zero (e.g. admin reset). The
  // Board toggle is hidden in that state so without this we'd leave the
  // user looking at an empty board with no way to flip back.
  useEffect(() => {
    if (pickIdx === 0 && mode === 'board') setMode('pick');
  }, [pickIdx, mode]);

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

  // Visibility flags for the new header pieces. Toggle only matters once a
  // pick has been made; strip lives in Pick mode (Board shows everything
  // natively); series tabs are picking-affordances and stay hidden in Board.
  const showToggle = !done && pickIdx > 0;
  const showStrip = !done && pickIdx > 0 && mode === 'pick';
  const showSeriesTabs = !done && cfg.bonusSeries.length > 0 && currentPicker && mode === 'pick';

  // Branch AFTER all hooks have run so the hook count stays stable
  // across regular/all-star renders (see comment near top).
  if (isAllStar) {
    return <AllStarDraftPaused state={state} me={me} currentRace={currentRace} onNav={onNav} screenLabel="Draft"/>;
  }

  return <div style={{ paddingBottom:20, display:'flex', flexDirection:'column', minHeight:'100%' }}>
    <div style={{ position:'sticky', top:0, zIndex:5, background: T.bg, paddingBottom:10 }}>
      <TopBar
        subtitle={`${currentRace?.track || ''} · Wk ${String(currentWeek).padStart(2,'0')}`}
        title="Draft"
        right={<BackChip onClick={() => onNav('back')} label="Exit"/>}
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
          onNav={onNav}
        />
      </div>

      {showToggle && <div style={{ padding:'10px 20px 0' }}>
        <ModeToggle mode={mode} onChange={setMode}/>
      </div>}

      {showStrip && <LatestPicksStrip
        picks={draftState.picks}
        players={players}
        freshPickKeys={freshPickKeys}
        lookupDriver={lookupDriver}
        onNav={onNav}
      />}

      {showSeriesTabs && <SeriesTabs
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

    {!done && mode === 'pick' && <DraftGrid
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
      onNav={onNav}
    />}

    {!done && mode === 'board' && <DraftBoard
      snakeOrder={snakeOrder}
      picks={draftState.picks}
      players={players}
      slotAssign={draftState.slotAssign}
      totalRounds={cfg.totalPicks}
      currentPickIdx={pickIdx}
      freshPickKeys={freshPickKeys}
      lookupDriver={lookupDriver}
      onNav={onNav}
    />}

    {!done && mode === 'pick' && activeSeries === 'Cup' && isAdmin && <div style={{ padding:'0 20px 24px' }}>
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
function OnTheClock({ currentPicker, pickIdx, totalPicks, round, totalRounds, myTurn, done, onNav }) {
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
    <PlayerBadge player={currentPicker} size={36} onClick={() => onNav('team', { playerId: currentPicker.id })}/>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.24em', textTransform:'uppercase', color: myTurn ? T.hot : 'rgba(247,244,237,0.5)' }}>
        {myTurn ? "You're up" : 'On the Clock'} · Round {round}/{totalRounds}
      </div>
      <div style={{ fontFamily: FD, fontSize:22, fontWeight:600, lineHeight:1.05, letterSpacing:'-0.03em', marginTop:2 }}>{currentPicker.name}</div>
    </div>
    <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:13, color:'rgba(247,244,237,0.55)', fontVariantNumeric:'tabular-nums' }}>{pickIdx+1}/{totalPicks}</div>
  </div>;
}

// ── Pick / Board mode toggle ───────────────────────────────────────
// Lightweight segmented control. Pick = driver pool grid for selecting.
// Board = full snake grid showing every pick made so far. Spectators
// (and the on-the-clock player between turns) flip to Board to see the
// whole state at a glance, then back to Pick to act when their turn comes.
function ModeToggle({ mode, onChange }) {
  const opts = [
    { id: 'pick', label: 'Pick' },
    { id: 'board', label: 'Board' },
  ];
  return (
    <div style={{
      display: 'flex',
      borderRadius: 3,
      overflow: 'hidden',
      border: `1px solid ${T.line}`,
      background: T.card,
    }}>
      {opts.map(o => {
        const active = mode === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              appearance: 'none',
              flex: 1,
              background: active ? T.ink : 'transparent',
              color: active ? T.bg : T.ink,
              border: 'none',
              padding: '9px 16px',
              fontFamily: FL, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.22em', textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background 120ms ease, color 120ms ease',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Latest picks strip ─────────────────────────────────────────────
// Three most recent picks, latest on top, all rendered at full ink intensity
// so the strip is uniformly readable. New arrivals get a brief copper-tinted
// background that fades to transparent over ~1s, riding the existing
// freshPickKeys signal so the visual matches the grid card flash.
//
// Stable React keys (`pick.at`) keep DOM nodes in place as new picks shift
// older ones down — so only the new top row is "new", the others slide
// without remounting. Bonus picks include a small series tag on the right
// so the source pool is visible without having to think about it.
function LatestPicksStrip({ picks, players, freshPickKeys, lookupDriver, onNav }) {
  if (picks.length === 0) return null;
  const recent = picks.slice(-3).reverse();
  const total = picks.length;
  return (
    <div style={{ padding: '8px 20px 0' }}>
      {recent.map((pk, i) => {
        const player = players.find(p => p.id === pk.playerId);
        const series = pk.series || 'Cup';
        const driver = lookupDriver(series, pk.driverNum);
        const overallNum = total - i; // 1-indexed pick number; latest = highest
        const isFresh = freshPickKeys.has(pickKey(series, pk.driverNum));
        return (
          <div
            key={`${pk.at}-${pk.driverNum}-${series}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '6px 8px',
              background: isFresh ? 'rgba(184, 147, 90, 0.22)' : 'transparent',
              transition: 'background 1000ms ease-out',
              borderRadius: 3,
              borderBottom: i === recent.length - 1 ? 'none' : `0.5px solid ${T.line2}`,
            }}
          >
            <span style={{
              fontFamily: FB, fontSize: 9, fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              color: T.mute, minWidth: 18, textAlign: 'right',
              letterSpacing: '-0.01em',
            }}>
              {String(overallNum).padStart(2, '0')}
            </span>
            {player && <PlayerBadge player={player} size={18} onClick={() => onNav('team', { playerId: player.id })}/>}
            <span style={{
              fontFamily: FD, fontSize: 12, fontWeight: 600,
              letterSpacing: '-0.02em',
              color: T.ink,
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
            }}>
              {player?.name || '—'}
            </span>
            <span style={{
              fontFamily: FI, fontStyle: 'italic', fontSize: 11,
              color: T.mute, flex: '0 0 auto',
            }}>→</span>
            <span style={{
              fontFamily: FB, fontSize: 11, fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: T.ink, letterSpacing: '-0.01em',
              flex: '0 0 auto',
            }}>
              #{pk.driverNum}
            </span>
            <span style={{
              fontFamily: FD, fontSize: 12, fontWeight: 600,
              letterSpacing: '-0.02em',
              color: T.ink,
              flex: 1, minWidth: 0,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {driver?.name || pk.driverName || ''}
            </span>
            {series !== 'Cup' && <span style={{
              fontFamily: FL, fontSize: 8, fontWeight: 600,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: T.hot, flex: '0 0 auto',
            }}>
              {(SERIES[series]?.short) || series.slice(0, 3).toUpperCase()}
            </span>}
          </div>
        );
      })}
    </div>
  );
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
function DraftGrid({ drivers, pickedKeys, activeSeries, draftState, players, onPick, remaining, isEmpty, isAdmin, onAddDriver, driverStats, freshPickKeys, onNav }) {
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

// ── Draft board ────────────────────────────────────────────────────
// Full snake grid view. Columns are players in slot order (left to right);
// rows are rounds (top to bottom). Each cell is the driver picked at that
// (round, slot) intersection, or a dashed placeholder if the pick hasn't
// happened yet. The on-the-clock cell gets a copper outline; freshly-landed
// picks ride the same hm-pickring animation used in the grid for visual
// consistency. Round labels include a snake direction arrow so the
// chronological flow is obvious at a glance.
function DraftBoard({ snakeOrder, picks, players, slotAssign, totalRounds, currentPickIdx, freshPickKeys, lookupDriver, onNav }) {
  const numPlayers = players.length;

  // (round, slot) → overall pick index. Lets us look up "what's at row 3,
  // col 2?" by indexing snakeOrder, which already encodes the snake.
  const slotByRoundIdx = useMemo(() => {
    const grid = {};
    for (let i = 0; i < snakeOrder.length; i++) {
      const { round, slot } = snakeOrder[i];
      if (!grid[round]) grid[round] = {};
      grid[round][slot] = i;
    }
    return grid;
  }, [snakeOrder]);

  // Players ordered by slot 1..N so the column header reads slot-1 leftmost.
  const playersBySlot = useMemo(() => {
    const out = [];
    const byId = new Map(players.map(p => [p.id, p]));
    for (let s = 1; s <= numPlayers; s++) {
      const entry = Object.entries(slotAssign || {}).find(([, sl]) => sl === s);
      out.push(entry ? byId.get(entry[0]) : null);
    }
    return out;
  }, [players, slotAssign, numPlayers]);

  // Track-style template: 28px gutter for round labels, equal columns per player.
  const cols = `28px repeat(${numPlayers}, minmax(0, 1fr))`;

  return (
    <div style={{ padding: '14px 14px 24px' }}>
      {/* Player header row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: cols,
        gap: 4,
        marginBottom: 8,
        alignItems: 'flex-end',
      }}>
        <div/>
        {playersBySlot.map((p, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 4,
            padding: '4px 0',
            minWidth: 0,
          }}>
            {p ? <PlayerBadge player={p} size={20} onClick={() => onNav('team', { playerId: p.id })}/> : <div style={{ width: 20, height: 20 }}/>}
            <div style={{
              fontFamily: FL, fontSize: 7, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: T.ink2,
              maxWidth: '100%',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {p?.name?.slice(0, 5) || '—'}
            </div>
          </div>
        ))}
      </div>

      {/* Round rows */}
      {Array.from({ length: totalRounds }, (_, r) => {
        const round = r + 1;
        const leftToRight = round % 2 === 1;
        const arrow = leftToRight ? '→' : '←';
        return (
          <div key={round} style={{
            display: 'grid',
            gridTemplateColumns: cols,
            gap: 4,
            marginBottom: 4,
          }}>
            {/* Round label gutter */}
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}>
              <div style={{
                fontFamily: FB, fontSize: 11, fontWeight: 700,
                color: T.ink2, letterSpacing: '-0.01em',
              }}>R{round}</div>
              <div style={{
                fontFamily: FB, fontSize: 9,
                color: T.mute, lineHeight: 1, marginTop: 1,
              }}>{arrow}</div>
            </div>
            {playersBySlot.map((p, i) => {
              const slot = i + 1;
              const overallIdx = slotByRoundIdx[round]?.[slot];
              const pk = (overallIdx != null && overallIdx < picks.length) ? picks[overallIdx] : null;
              const series = pk?.series || 'Cup';
              const driver = pk ? lookupDriver(series, pk.driverNum) : null;
              const isCurrent = overallIdx === currentPickIdx;
              const isFresh = pk ? freshPickKeys.has(pickKey(series, pk.driverNum)) : false;
              const filled = !!pk;
              const lastName = driver?.name?.split(' ').slice(-1)[0] || (pk?.driverName?.split(' ').slice(-1)[0]) || (pk ? `#${pk.driverNum}` : '');
              return (
                <div key={i} style={{
                  position: 'relative',
                  border: filled
                    ? `1px solid ${T.line}`
                    : `1px dashed ${isCurrent ? T.hot : T.line2}`,
                  borderRadius: 4,
                  padding: '4px 2px',
                  height: 58,
                  background: filled ? '#FEFCF7' : 'transparent',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 2,
                  minWidth: 0,
                  animation: isFresh ? 'hm-pickring 900ms ease-out forwards' : 'none',
                  boxShadow: isCurrent && !filled ? `0 0 0 1px ${T.hot}, inset 0 0 0 1px rgba(184,147,90,0.18)` : 'none',
                }}>
                  {filled ? (
                    driver ? <>
                      <CarNum driver={driver} size={22} onClick={series === 'Cup' ? () => onNav('drivers', { driverNum: driver.num }) : undefined}/>
                      <div style={{
                        fontFamily: FD, fontSize: 9, fontWeight: 600,
                        letterSpacing: '-0.02em',
                        color: T.ink,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        width: '100%', textAlign: 'center',
                        lineHeight: 1.05,
                      }}>
                        {lastName.slice(0, 6)}
                      </div>
                      <div style={{
                        position: 'absolute', top: 2, right: 3,
                        fontFamily: FB, fontSize: 7, fontWeight: 700,
                        color: T.mute,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {overallIdx + 1}
                      </div>
                      {series !== 'Cup' && <div style={{
                        position: 'absolute', bottom: 1, left: 2,
                        fontFamily: FL, fontSize: 6, fontWeight: 700,
                        color: T.hot,
                        letterSpacing: '0.15em', textTransform: 'uppercase',
                      }}>
                        {SERIES[series]?.short || series.slice(0, 3).toUpperCase()}
                      </div>}
                    </> : <>
                      {/* Pick exists but driver lookup failed — fallback. */}
                      <div style={{
                        fontFamily: FB, fontSize: 13, fontWeight: 700,
                        color: T.ink, fontVariantNumeric: 'tabular-nums',
                      }}>#{pk.driverNum}</div>
                      <div style={{
                        fontFamily: FD, fontSize: 9, color: T.mute,
                      }}>—</div>
                    </>
                  ) : (
                    <span style={{
                      fontFamily: FI, fontStyle: 'italic',
                      fontSize: isCurrent ? 14 : 11,
                      color: isCurrent ? T.hot : T.line2,
                      lineHeight: 1,
                    }}>
                      {isCurrent ? '⏱' : '·'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Quiet caption — explains the arrow column without crowding the grid. */}
      <div style={{
        marginTop: 14,
        fontFamily: FI, fontStyle: 'italic',
        fontSize: 11, color: T.mute,
        textAlign: 'center',
      }}>
        Snake order — direction reverses each round
      </div>
    </div>
  );
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
            <PlayerBadge player={p} size={22} onClick={() => onNav('team', { playerId: p.id })}/>
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
                    ? <CarNum key={`${series}:${pk.driverNum}`} driver={d} size={32} onClick={series === 'Cup' ? () => onNav('drivers', { driverNum: d.num }) : undefined}/>
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
