'use client';
import React, { useState } from 'react';
import { BackChip, CarNum, LabeledInput, PlayerBadge, SectionLabel, TopBar } from '@/components/ui/primitives';
import { ADMIN_ID, FB, FD, FI, FL, FM, T } from '@/lib/constants';
import { DEFAULT_DRIVERS } from '@/lib/data';

// Recompute the per-player rollup for a given week using its driverPoints + bonuses + overrides.
// This is invoked on every entry so live standings stay correct, not just on Save & Advance.
function rollupPts(players, picks, driverPoints = {}, bonuses = {}, overrides = {}) {
  const pts = {};
  players.forEach(p => {
    const nums = picks.filter(pk => pk.playerId === p.id).map(pk => pk.driverNum);
    const base = nums.reduce((sum, n) => sum + (driverPoints[n] || 0), 0);
    const b = bonuses[p.id] || 0;
    const o = overrides[p.id];
    pts[p.id] = o != null ? o : (base + b);
  });
  return pts;
}

export default function EnterResultsScreen({ state, setState, me, onNav, editWeek }) {
  // editWeek (optional) — when provided, admin is editing a past finalized week
  // instead of entering the current one. Targeted picks come from draftHistory.
  const targetWeek = editWeek || state.currentWeek;
  const isPastEdit = editWeek != null && editWeek !== state.currentWeek;

  const { players, drivers, schedule, weeklyResults, draftState, draftHistory = [] } = state;
  const currentRace = schedule.find(s => s.wk === targetWeek);
  const isAdmin = me.id === ADMIN_ID;

  const existing = weeklyResults.find(w => w.wk === targetWeek);
  const driverPoints = existing?.driverPoints || {};
  const bonuses = existing?.bonuses || {};
  const overrides = existing?.overrides || {};

  // For past edits, draft data lives in draftHistory; for current week, in draftState.
  const picks = isPastEdit
    ? (draftHistory.find(h => h.wk === targetWeek)?.picks || [])
    : (draftState?.picks || []);

  const draftedNums = [...new Set(picks.map(p => p.driverNum))];
  const draftedDrivers = draftedNums
    .map(n => drivers.find(d => d.num === n))
    .filter(Boolean)
    .sort((a, b) => a.num - b.num);

  // Display totals — recomputed on render so live values track inputs exactly.
  const totals = rollupPts(players, picks, driverPoints, bonuses, overrides);
  const bases = {};
  players.forEach(p => {
    const nums = picks.filter(pk => pk.playerId === p.id).map(pk => pk.driverNum);
    bases[p.id] = nums.reduce((s, n) => s + (driverPoints[n] || 0), 0);
  });

  // ALWAYS recomputes pts so non-admins' standings views stay consistent during entry.
  const patchWeek = (updates) => {
    setState(s => {
      const ex = s.weeklyResults.find(w => w.wk === targetWeek) || {};
      const track = s.schedule.find(sc => sc.wk === targetWeek)?.track;
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

  const setDriverPts = (num, val) => {
    const next = { ...driverPoints };
    if (val === '') delete next[num]; else next[num] = parseInt(val) || 0;
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

  // Two-tap confirmation: arm on first tap, fire on second within 3s.
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
      const track = s.schedule.find(sc => sc.wk === s.currentWeek)?.track;
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
        draftHistory.push({ wk: s.currentWeek, track, slotAssign: s.draftState.slotAssign, picks: s.draftState.picks });
      }
      const nextWeek = s.currentWeek + 1;
      const hasNext = !!s.schedule.find(sc => sc.wk === nextWeek);
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
  const anyEntered = Object.keys(driverPoints).length > 0 || Object.keys(overrides).length > 0;

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
                : 'Enter each drafted driver\u2019s Cup points from nascar.com. Totals update live. Use Bonus for other-series drivers, Override to set a final number.')
            : 'Admin will enter driver points after the race.'}
        </div>
      </div>
    </div>

    {draftedDrivers.length > 0 && <>
      <SectionLabel right={isAdmin ? <span style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, textTransform:'none', letterSpacing:'0.01em', color: T.mute }}>{Object.keys(driverPoints).length}/{draftedDrivers.length} entered</span> : null}>Driver Points</SectionLabel>
      <div style={{ padding:'14px 20px 20px' }}>
        {draftedDrivers.map((d, i) => {
          const owners = picks.filter(pk => pk.driverNum === d.num).map(pk => players.find(p => p.id === pk.playerId)).filter(Boolean);
          return <div key={d.num} style={{
            display:'flex', alignItems:'center', gap:12,
            padding:'12px 0',
            borderBottom: i === draftedDrivers.length-1 ? 'none' : `0.5px solid ${T.line2}`,
          }}>
            <CarNum driver={d} size={34}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily: FD, fontSize:16, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1.1 }}>{d.name}</div>
              <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:4, flexWrap:'wrap' }}>
                {owners.map((o, oi) => <span key={o.id+oi} style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                  <PlayerBadge player={o} size={14}/>
                  <span style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, color: T.mute }}>{o.name}</span>
                </span>)}
              </div>
            </div>
            <input type="number" inputMode="numeric" value={driverPoints[d.num] ?? ''} onChange={e => setDriverPts(d.num, e.target.value)}
              disabled={!isAdmin}
              placeholder="—"
              style={{
                width:72, textAlign:'right', padding:'9px 10px',
                border:`0.5px solid ${T.line}`, borderRadius:3,
                background: isAdmin ? T.card : T.bg2,
                outline:'none', color: T.ink,
                fontFamily: FB, fontSize:16, fontWeight:600, fontVariantNumeric:'tabular-nums',
              }}/>
          </div>;
        })}
      </div>
    </>}

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
        fontFamily: FL, fontSize:11, fontWeight:500,
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
        fontFamily: FL, fontSize:11, fontWeight:500,
        letterSpacing:'0.24em', textTransform:'uppercase',
      }}>Done · Back to History</button>
    </div>}
  </div>;
}
