'use client';
import React, { useState } from 'react';
import { BackChip, CarNum, LabeledInput, PlayerBadge, SectionLabel, TopBar } from '@/components/ui/primitives';
import { ADMIN_ID, FB, FD, FI, FL, FM, SERIES, T } from '@/lib/constants';
import { DEFAULT_DRIVERS, DEFAULT_SCHEDULE } from '@/lib/data';
import { ptsKey, lookupPts, rollupPts } from '@/lib/scoring';
import { getBonusPool, getWeekConfig } from '@/lib/utils';

// All-Star Race entry form — used when targetWeek's schedule entry has
// format: 'all-star'. The All-Star is a non-points exhibition: the only
// scoring is a 50-pt all-or-nothing bonus to anyone who picked the
// winner. So instead of a per-driver points grid, the admin enters
// just the winning driver number; we derive pts directly from
// currentRace.allStarPicks vs the winner. Saving advances normally.
function AllStarEntryForm({ state, setState, me, currentRace, onNav, targetWeek, isPastEdit }) {
  const isAdmin = me.id === ADMIN_ID;
  const existing = state.weeklyResults.find(w => w.wk === targetWeek);
  const [winnerNum, setWinnerNum] = useState(
    existing?.allStarWinnerNum != null ? String(existing.allStarWinnerNum) : ''
  );
  const picks = currentRace.allStarPicks || {};
  const pool = state.drivers || DEFAULT_DRIVERS;
  const driverFor = (num) =>
    pool.find(d => d.num === num)
    || DEFAULT_DRIVERS.find(d => d.num === num)
    || null;

  const parsedWinner = parseInt(winnerNum, 10);
  const winnerValid = Number.isFinite(parsedWinner);
  const winnerDriver = winnerValid ? driverFor(parsedWinner) : null;

  // Preview each player's resulting points. 50 if they picked the entered
  // winner, otherwise 0. Always renders so the admin can sanity-check
  // before committing.
  const previewPts = {};
  state.players.forEach(p => {
    const pick = picks[p.id];
    previewPts[p.id] = winnerValid && pick != null && parsedWinner === pick ? 50 : 0;
  });

  const [advanceArm, setAdvanceArm] = useState(false);
  const saveAndAdvance = () => {
    if (!winnerValid) return;
    if (!advanceArm) {
      setAdvanceArm(true);
      setTimeout(() => setAdvanceArm(false), 3000);
      return;
    }
    setAdvanceArm(false);
    // IMPORTANT: source the All-Star picks and track from `currentRace`
    // (from the migrated state view in the outer closure), NOT from
    // `s.schedule` inside this updater. `s` is the raw remote state,
    // and the schedule is never persisted to Supabase — migrateState
    // always overlays DEFAULT_SCHEDULE at read time. So `s.schedule`
    // here is the stale pre-PR schedule, where wk 13 was Charlotte
    // and `allStarPicks` doesn't exist — reading from it would write
    // 0 pts for every player. The DEFAULT_SCHEDULE constant is the
    // source of truth, and `currentRace` already came from there.
    setState(s => {
      const ex = s.weeklyResults.find(w => w.wk === targetWeek) || {};
      const pts = {};
      s.players.forEach(p => {
        const pick = picks[p.id];
        pts[p.id] = pick != null && parsedWinner === pick ? 50 : 0;
      });
      const newRes = {
        ...ex, wk: targetWeek, track: currentRace.track,
        pts, allStarWinnerNum: parsedWinner, finalized: true,
      };
      // Past-edit doesn't advance the week. Live entry advances normally,
      // resetting draftState so the next week's slot-pick can begin.
      const willAdvance = !isPastEdit;
      const nextWeek = willAdvance ? targetWeek + 1 : s.currentWeek;
      // hasNext checks against the imported DEFAULT_SCHEDULE constant
      // for the same reason we don't use `s.schedule` for picks/track —
      // `s.schedule` is the stale server-persisted schedule.
      const hasNext = DEFAULT_SCHEDULE.some(sc => sc.wk === nextWeek);
      const newWkExtras = hasNext ? ((s.weekDriversExtra || {})[nextWeek] || []) : [];
      return {
        ...s,
        weeklyResults: [...s.weeklyResults.filter(w => w.wk !== targetWeek), newRes],
        currentWeek: willAdvance && hasNext ? nextWeek : s.currentWeek,
        drivers: willAdvance && hasNext ? [...DEFAULT_DRIVERS, ...newWkExtras] : s.drivers,
        draftState: willAdvance && hasNext
          ? { phase:'slot-pick', slotPickIdx:0, slotAssign:{}, currentRound:1, picks:[] }
          : s.draftState,
      };
    });
    setTimeout(() => onNav(isPastEdit ? 'history' : 'home'), 200);
  };

  const sorted = [...state.players].sort((a, b) => (previewPts[b.id] || 0) - (previewPts[a.id] || 0));

  return <div style={{ paddingBottom:20 }}>
    <TopBar
      subtitle={`Wk ${String(targetWeek).padStart(2,'0')} · All-Star Race${isPastEdit ? ' · Editing' : ''}`}
      title={isPastEdit ? 'Edit All-Star' : 'All-Star Winner'}
      right={<BackChip onClick={() => onNav(isPastEdit ? 'history' : 'home')}/>}
    />

    {/* Intro panel — same dark hero treatment as normal week, with the
        copper accent that marks All-Star throughout the app. */}
    <div style={{ padding:'0 20px 16px' }}>
      <div style={{
        background: T.ink, color: T.bg, borderRadius:4,
        border:`1px solid ${T.hot}`, padding:'18px 20px',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <span style={{ color: T.hot, fontSize:12, lineHeight:1 }}>★</span>
          <div style={{
            fontFamily: FL, fontSize:9, fontWeight:600,
            letterSpacing:'0.28em', textTransform:'uppercase', color: T.hot,
          }}>{isAdmin ? 'Commissioner Entry · All-Star' : 'Waiting on Commissioner'}</div>
        </div>
        <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:14, color:'rgba(247,244,237,0.85)', lineHeight:1.5 }}>
          {isAdmin
            ? 'Enter the winning driver number. Anyone who picked the winner gets +50 points; everyone else gets 0.'
            : 'Admin will enter the All-Star winner after the race. Picks are already locked.'}
        </div>
      </div>
    </div>

    {/* Winner input (admin) */}
    {isAdmin && <>
      <SectionLabel>Winning Driver</SectionLabel>
      <div style={{ padding:'14px 20px 20px' }}>
        <div style={{
          background: T.card, border:`1px solid ${T.line}`, borderRadius:4,
          padding:'14px 16px',
          display:'flex', alignItems:'center', gap:14,
        }}>
          <input
            type="number" inputMode="numeric"
            value={winnerNum}
            onChange={e => setWinnerNum(e.target.value)}
            placeholder="#"
            style={{
              width:90, textAlign:'center', padding:'12px 8px',
              border:`1px solid ${T.line}`, borderRadius:3,
              background: T.bg, outline:'none', color: T.ink,
              fontFamily: FB, fontSize:22, fontWeight:700, fontVariantNumeric:'tabular-nums',
            }}/>
          <div style={{ flex:1, minWidth:0 }}>
            {winnerDriver ? <>
              <div style={{ fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.02em' }}>{winnerDriver.name}</div>
              <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, color: T.mute, marginTop:3 }}>
                № {winnerDriver.num} · {winnerDriver.team || '—'}
              </div>
            </> : <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute }}>
              {winnerValid ? `Driver #${parsedWinner} not in pool — bonus will still apply if anyone picked them.` : 'Enter the car number that won the race.'}
            </div>}
          </div>
        </div>
      </div>
    </>}

    {/* Preview standings */}
    <SectionLabel>Standings · This Week</SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      {sorted.map((p, i) => {
        const total = previewPts[p.id] || 0;
        const pick = picks[p.id];
        const pickDriver = pick != null ? driverFor(pick) : null;
        return <div key={p.id} style={{
          padding:'14px 0',
          borderBottom: i === sorted.length-1 ? 'none' : `0.5px solid ${T.line2}`,
          display:'flex', alignItems:'center', gap:12,
        }}>
          <div style={{
            fontFamily: FD, fontSize:18, fontWeight:600, width:22,
            color: total > 0 ? T.hot : T.ink, fontVariantNumeric:'tabular-nums',
          }}>{String(i+1).padStart(2,'0')}</div>
          <PlayerBadge player={p} size={26}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily: FD, fontSize:16, fontWeight:600, letterSpacing:'-0.02em' }}>{p.name}</div>
            <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, color: T.mute, marginTop:2 }}>
              {pickDriver ? `Picked #${pickDriver.num} ${pickDriver.name}` : 'No pick on file'}
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{
              fontFamily: FB, fontSize:20, fontWeight:600,
              fontVariantNumeric:'tabular-nums',
              color: total > 0 ? T.hot : T.ink,
            }}>{total}</div>
            {total > 0 && <div style={{ fontFamily: FM, fontSize:9, color: T.hot, marginTop:2, letterSpacing:'0.04em' }}>+50 BONUS</div>}
          </div>
        </div>;
      })}
    </div>

    {isAdmin && <div style={{ padding:'0 20px 20px' }}>
      <button onClick={saveAndAdvance} disabled={!winnerValid} style={{
        appearance:'none', width:'100%', padding:16,
        background: !winnerValid ? T.line : (advanceArm ? T.hot : T.ink),
        color: !winnerValid ? T.mute : (advanceArm ? T.ink : T.bg),
        border:'none', borderRadius:3,
        cursor: winnerValid ? 'pointer' : 'not-allowed',
        fontFamily: FL, fontSize:11, fontWeight:600,
        letterSpacing:'0.24em', textTransform:'uppercase',
      }}>{!winnerValid
        ? 'Enter Winning Driver Number'
        : advanceArm
          ? (isPastEdit ? 'Tap again to confirm edit' : `Tap again to confirm — locks Wk ${String(targetWeek).padStart(2,'0')}`)
          : (isPastEdit ? 'Save Edit →' : `Save & Advance to Week ${String(targetWeek+1).padStart(2,'0')} →`)}</button>
      <div style={{ marginTop:10, fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute, textAlign:'center', lineHeight:1.5 }}>
        {isPastEdit
          ? 'Standings will recalculate based on the new winner.'
          : 'This locks the All-Star result and starts the next regular week.'}
      </div>
    </div>}
  </div>;
}

export default function EnterResultsScreen({ state, setState, me, onNav, editWeek }) {
  const targetWeek = editWeek || state.currentWeek;
  const isPastEdit = editWeek != null && editWeek !== state.currentWeek;

  const { players, schedule, weeklyResults, draftState, draftHistory = [] } = state;
  const currentRace = schedule.find(s => s.wk === targetWeek);
  const isAdmin = me.id === ADMIN_ID;

  // All-Star weeks use a totally different scoring model (one pre-locked
  // pick per player, 50-pt bonus if they picked the winner). Branch to
  // the dedicated form before deriving the regular driver-points grid.
  if (currentRace?.format === 'all-star') {
    return <AllStarEntryForm
      state={state} setState={setState} me={me} currentRace={currentRace}
      onNav={onNav} targetWeek={targetWeek} isPastEdit={isPastEdit}
    />;
  }

  const existing = weeklyResults.find(w => w.wk === targetWeek);
  const driverPoints = existing?.driverPoints || {};
  const bonuses = existing?.bonuses || {};
  const overrides = existing?.overrides || {};

  // Picks for this week. New format includes `series`; old format omitted it
  // (defaults to 'Cup').
  const picks = isPastEdit
    ? (draftHistory.find(h => h.wk === targetWeek)?.picks || [])
    : (draftState?.picks || []);

  // Build the canonical drafted-driver list for this week, grouped by series.
  // We resolve each pick to its driver definition (Cup → DEFAULT_DRIVERS +
  // weekly extras; bonus → bonusDriversByWeek). If we can't resolve, we
  // synthesize a stub from the pick's `driverName` snapshot.
  const wkExtras = (state.weekDriversExtra || {})[targetWeek] || [];
  const cupPool = [...DEFAULT_DRIVERS, ...wkExtras];

  const draftedBySeries = {};
  picks.forEach(pk => {
    const series = pk.series || 'Cup';
    const pool = series === 'Cup' ? cupPool : getBonusPool(state, targetWeek, series);
    const d = pool.find(x => x.num === pk.driverNum) || {
      num: pk.driverNum,
      name: pk.driverName || `#${pk.driverNum}`,
      team: '—', primary: T.mute, secondary: T.ink,
    };
    if (!draftedBySeries[series]) draftedBySeries[series] = [];
    if (!draftedBySeries[series].some(x => x.num === d.num)) {
      draftedBySeries[series].push(d);
    }
  });
  Object.values(draftedBySeries).forEach(list => list.sort((a, b) => a.num - b.num));

  const totals = rollupPts(players, picks, driverPoints, bonuses, overrides);
  const bases = {};
  players.forEach(p => {
    const myPicks = picks.filter(pk => pk.playerId === p.id);
    bases[p.id] = myPicks.reduce((s, pk) => s + (lookupPts(driverPoints, pk.series, pk.driverNum) || 0), 0);
  });

  const totalEntries = Object.keys(driverPoints).length;
  const totalDrafted = Object.values(draftedBySeries).reduce((s, list) => s + list.length, 0);

  // Live patch — every keystroke recomputes pts so non-admin standings stay current.
  // NOTE: source `track` from DEFAULT_SCHEDULE rather than `s.schedule` —
  // the persisted server schedule lags behind code (it's overwritten in
  // the migrated view only), so post-renumber wks (14+) would otherwise
  // get the old/wrong track name baked into weeklyResults.
  const patchWeek = (updates) => {
    setState(s => {
      const ex = s.weeklyResults.find(w => w.wk === targetWeek) || {};
      const track = DEFAULT_SCHEDULE.find(sc => sc.wk === targetWeek)?.track;
      const wkPicks = isPastEdit
        ? ((s.draftHistory || []).find(h => h.wk === targetWeek)?.picks || [])
        : (s.draftState?.picks || []);
      const merged = { ...ex, wk: targetWeek, track, ...updates };
      merged.pts = rollupPts(
        s.players,
        wkPicks,
        merged.driverPoints || {},
        merged.bonuses || {},
        merged.overrides || {},
      );
      return { ...s, weeklyResults: [...s.weeklyResults.filter(w => w.wk !== targetWeek), merged] };
    });
  };

  const setDriverPts = (series, num, val) => {
    const next = { ...driverPoints };
    const k = ptsKey(series, num);
    // Also clear any legacy flat-num key so the two don't drift.
    if ((series || 'Cup') === 'Cup' && Object.prototype.hasOwnProperty.call(next, num)) delete next[num];
    if (val === '') delete next[k]; else next[k] = parseInt(val) || 0;
    patchWeek({ driverPoints: next });
  };
  const setBonus = (pid, val) => {
    const next = { ...bonuses };
    const v = val === '' ? 0 : (parseInt(val) || 0);
    if (v === 0) delete next[pid]; else next[pid] = v;
    patchWeek({ bonuses: next });
  };
  const setOverride = (pid, val) => {
    const next = { ...overrides };
    if (val === '') delete next[pid]; else next[pid] = parseInt(val) || 0;
    patchWeek({ overrides: next });
  };

  const [advanceArm, setAdvanceArm] = useState(false);
  const saveAndAdvance = () => {
    if (!advanceArm) {
      setAdvanceArm(true);
      setTimeout(() => setAdvanceArm(false), 3000);
      return;
    }
    setAdvanceArm(false);
    setState(s => {
      const ex = s.weeklyResults.find(w => w.wk === s.currentWeek) || {};
      // Source track and hasNext from DEFAULT_SCHEDULE — see patchWeek
      // note above for why s.schedule is unreliable.
      const track = DEFAULT_SCHEDULE.find(sc => sc.wk === s.currentWeek)?.track;
      const pts = rollupPts(
        s.players,
        s.draftState?.picks || [],
        ex.driverPoints || {},
        ex.bonuses || {},
        ex.overrides || {},
      );
      const newRes = { ...ex, wk: s.currentWeek, track, pts, finalized: true };
      const draftHistory = [...(s.draftHistory || [])];
      if (s.draftState?.picks?.length > 0 && !draftHistory.find(h => h.wk === s.currentWeek)) {
        draftHistory.push({
          wk: s.currentWeek, track,
          slotAssign: s.draftState.slotAssign,
          picks: s.draftState.picks, // includes series + driverName per pick
        });
      }
      const nextWeek = s.currentWeek + 1;
      const hasNext = DEFAULT_SCHEDULE.some(sc => sc.wk === nextWeek);
      const newWkExtras = hasNext ? ((s.weekDriversExtra || {})[nextWeek] || []) : [];
      return {
        ...s,
        weeklyResults: [...s.weeklyResults.filter(w => w.wk !== s.currentWeek), newRes],
        draftHistory,
        currentWeek: hasNext ? nextWeek : s.currentWeek,
        drivers: hasNext ? [...DEFAULT_DRIVERS, ...newWkExtras] : s.drivers,
        draftState: hasNext ? { phase:'slot-pick', slotPickIdx:0, slotAssign:{}, currentRound:1, picks:[] } : s.draftState,
      };
    });
    setTimeout(() => onNav('home'), 200);
  };

  const sorted = [...players].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0));
  const anyEntered = totalEntries > 0 || Object.keys(overrides).length > 0;

  // Render order — Cup first, then bonus series in config order
  const cfg = getWeekConfig(state, targetWeek);
  const seriesRenderOrder = Object.keys(cfg.allotments).filter(s => draftedBySeries[s]);

  return <div style={{ paddingBottom:20 }}>
    <TopBar
      subtitle={`Wk ${String(targetWeek).padStart(2,'0')} · ${currentRace?.track || ''}${isPastEdit ? ' · Editing' : ''}`}
      title={isPastEdit ? 'Edit Results' : 'Results'}
      right={<BackChip onClick={() => onNav(isPastEdit ? 'history' : 'home')}/>}
    />

    <div style={{ padding:'0 20px 16px' }}>
      <div style={{ background: T.ink, color: T.bg, borderRadius:4, padding:'18px 20px' }}>
        <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.24em', textTransform:'uppercase', color:'rgba(247,244,237,0.4)' }}>
          {isPastEdit ? 'Editing Past Week' : (isAdmin ? 'Commissioner Entry' : 'Waiting on Commissioner')}
        </div>
        <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:14, color:'rgba(247,244,237,0.75)', marginTop:8, lineHeight:1.5 }}>
          {isAdmin
            ? (isPastEdit
                ? 'Updating a past week. Standings recalculate automatically. Tap Done when finished.'
                : `Enter each drafted driver's points. Bonus picks count toward the same weekly total as Cup picks. Override sets a final number.`)
            : 'Admin will enter driver points after each race.'}
        </div>
      </div>
    </div>

    {seriesRenderOrder.map(series => {
      const list = draftedBySeries[series];
      const meta = SERIES[series] || { label: series };
      const enteredHere = list.filter(d => lookupPts(driverPoints, series, d.num) != null).length;
      return <div key={series}>
        <SectionLabel right={isAdmin
          ? <span style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, textTransform:'none', letterSpacing:'0.01em', color: T.mute }}>{enteredHere}/{list.length} entered</span>
          : null
        }>{meta.label} Points</SectionLabel>
        <div style={{ padding:'14px 20px 20px' }}>
          {list.map((d, i) => {
            const owners = picks
              .filter(pk => pk.driverNum === d.num && (pk.series || 'Cup') === series)
              .map(pk => players.find(p => p.id === pk.playerId))
              .filter(Boolean);
            return <div key={`${series}:${d.num}`} style={{
              display:'flex', alignItems:'center', gap:12,
              padding:'12px 0',
              borderBottom: i === list.length-1 ? 'none' : `0.5px solid ${T.line2}`,
            }}>
              <CarNum driver={d} size={34}
                onClick={series === 'Cup' ? () => onNav('drivers', { driverNum: d.num }) : undefined}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily: FD, fontSize:16, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1.1 }}>{d.name}</div>
                <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:4, flexWrap:'wrap' }}>
                  {owners.map((o, oi) => <span key={o.id+oi} style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                    <PlayerBadge player={o} size={14}/>
                    <span style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, color: T.mute }}>{o.name}</span>
                  </span>)}
                </div>
              </div>
              <input type="number" inputMode="numeric"
                value={lookupPts(driverPoints, series, d.num) ?? ''}
                onChange={e => setDriverPts(series, d.num, e.target.value)}
                disabled={!isAdmin}
                placeholder="—"
                style={{
                  width:72, textAlign:'right', padding:'9px 10px',
                  border:`1px solid ${T.line}`, borderRadius:3,
                  background: isAdmin ? T.card : T.bg2,
                  outline:'none', color: T.ink,
                  fontFamily: FB, fontSize:16, fontWeight:600, fontVariantNumeric:'tabular-nums',
                }}/>
            </div>;
          })}
        </div>
      </div>;
    })}

    <SectionLabel>Standings · This Week</SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      {sorted.map((p, i) => {
        const base = bases[p.id] || 0;
        const bonus = bonuses[p.id] || 0;
        const ov = overrides[p.id];
        const total = totals[p.id] || 0;
        return <div key={p.id} style={{
          padding:'14px 0',
          borderBottom: i === sorted.length-1 ? 'none' : `0.5px solid ${T.line2}`,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ fontFamily: FD, fontSize:18, fontWeight:600, width:22, color: i === 0 && total > 0 ? T.hot : T.ink, fontVariantNumeric:'tabular-nums' }}>{String(i+1).padStart(2,'0')}</div>
            <PlayerBadge player={p} size={26}/>
            <div style={{ flex:1, fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em' }}>{p.name}</div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily: FB, fontSize:18, fontWeight:600, fontVariantNumeric:'tabular-nums', color: i === 0 && total > 0 ? T.hot : T.ink }}>{total}</div>
              {(base || bonus || ov != null) && <div style={{ fontFamily: FM, fontSize:9, color: T.mute, marginTop:2 }}>
                {base}{bonus ? ` + ${bonus}` : ''}{ov != null ? ` → ${ov}` : ''}
              </div>}
            </div>
          </div>
          {isAdmin && <div style={{ marginTop:10, display:'flex', gap:8 }}>
            <LabeledInput label="Bonus" value={bonuses[p.id] || ''} onChange={v => setBonus(p.id, v)} placeholder="0"/>
            <LabeledInput label="Override" value={overrides[p.id] ?? ''} onChange={v => setOverride(p.id, v)} placeholder="—"/>
          </div>}
        </div>;
      })}
    </div>

    {isAdmin && !isPastEdit && anyEntered && <div style={{ padding:'0 20px 20px' }}>
      <button onClick={saveAndAdvance} style={{
        appearance:'none', width:'100%', padding:16,
        background: advanceArm ? T.hot : T.ink,
        color: advanceArm ? T.ink : T.bg,
        border:'none', borderRadius:3, cursor:'pointer',
        fontFamily: FL, fontSize:11, fontWeight:600,
        letterSpacing:'0.24em', textTransform:'uppercase',
      }}>{advanceArm
        ? `Tap again to confirm — locks Wk ${String(state.currentWeek).padStart(2,'0')}`
        : `Save & Advance to Week ${String(state.currentWeek+1).padStart(2,'0')} →`}</button>
      <div style={{ marginTop:10, fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute, textAlign:'center', lineHeight:1.5 }}>
        This locks results for Week {String(state.currentWeek).padStart(2,'0')} and starts the next draft. You can still edit past weeks from History.
      </div>
    </div>}

    {isAdmin && isPastEdit && <div style={{ padding:'0 20px 20px' }}>
      <button onClick={() => onNav('history')} style={{
        appearance:'none', width:'100%', padding:16,
        background: T.ink, color: T.bg, border:'none', borderRadius:3, cursor:'pointer',
        fontFamily: FL, fontSize:11, fontWeight:600,
        letterSpacing:'0.24em', textTransform:'uppercase',
      }}>Done · Back to History</button>
    </div>}
  </div>;
}
