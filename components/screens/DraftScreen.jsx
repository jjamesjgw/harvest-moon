'use client';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { AllStarDraftPaused, BackChip, TopBar } from '@/components/ui/primitives';
import { FD, FL, T } from '@/lib/constants';
import { DEFAULT_DRIVERS } from '@/lib/data';
import {
  buildSnakeOrder, computeAllDriverStats, countPicksBySeries, getBonusPool,
  getWeekConfig,
} from '@/lib/utils';
import { pickKey } from '@/components/draft/pickKey';
import { OnTheClock } from '@/components/draft/OnTheClock';
import { ModeToggle } from '@/components/draft/ModeToggle';
import { LatestPicksStrip } from '@/components/draft/LatestPicksStrip';
import { SeriesTabs } from '@/components/draft/SeriesTabs';
import { DraftGrid } from '@/components/draft/DraftGrid';
import { DraftBoard } from '@/components/draft/DraftBoard';
import { DraftComplete } from '@/components/draft/DraftComplete';

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

  // The active driver pool for whichever series tab is selected.
  const activePool = useMemo(() => {
    if (activeSeries === 'Cup') return cupDrivers;
    return getBonusPool(state, currentWeek, activeSeries);
  }, [activeSeries, cupDrivers, state, currentWeek]);

  const pick = (driver) => {
    if (!canPick) return;
    if (pickedKeys.has(pickKey(activeSeries, driver.num))) return;
    if (remainingForPicker(activeSeries) <= 0) return;
    try { navigator.vibrate?.(40); } catch {}
    const newPicks = [...draftState.picks, {
      playerId: onClock.playerId,
      series: activeSeries,
      driverNum: driver.num,
      driverName: driver.name,
      at: Date.now(),
    }];
    const completing = newPicks.length >= totalDraftPicks;
    const nextRound = onClock.round;
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
      pool={{
        drivers: activePool,
        activeSeries,
        driverStats,
        freshPickKeys,
        remaining: remainingForPicker(activeSeries),
        isEmpty: activePool.length === 0,
        isAdmin,
      }}
      draft={{
        pickedKeys,
        picks: draftState.picks,
        players,
      }}
      handlers={{
        onPick: pick,
        onAddDriver: () => onNav('manage-drivers'),
        onNav,
      }}
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
