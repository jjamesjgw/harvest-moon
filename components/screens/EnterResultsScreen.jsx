'use client';
import React from 'react';
import { BackChip, CarNum, LabeledInput, PlayerBadge, SectionLabel, TopBar } from '@/components/ui/primitives';
import { FB, FD, FI, FL, FM, T } from '@/lib/constants';
import { DEFAULT_DRIVERS } from '@/lib/data';

export default function EnterResultsScreen({ state, setState, me, onNav }) {
  const { players, drivers, schedule, currentWeek, weeklyResults, draftState, adminId } = state;
  const currentRace = schedule.find(s => s.wk === currentWeek);
  const admin = players.find(p => p.id === adminId) || players[0];
  const isAdmin = me.id === admin.id;

  const existing = weeklyResults.find(w => w.wk === currentWeek);
  const driverPoints = existing?.driverPoints || {};
  const bonuses = existing?.bonuses || {};
  const overrides = existing?.overrides || {};

  // Drivers actually picked this week
  const picks = draftState?.picks || [];
  const draftedNums = [...new Set(picks.map(p => p.driverNum))];
  const draftedDrivers = draftedNums.map(n => drivers.find(d => d.num === n)).filter(Boolean).sort((a,b) => a.num - b.num);

  // Compute per-player totals
  const totals = {}; const bases = {};
  players.forEach(p => {
    const nums = picks.filter(pk => pk.playerId === p.id).map(pk => pk.driverNum);
    const base = nums.reduce((s, n) => s + (driverPoints[n] || 0), 0);
    bases[p.id] = base;
    const bonus = bonuses[p.id] || 0;
    const ov = overrides[p.id];
    totals[p.id] = ov != null ? ov : (base + bonus);
  });

  const patchWeek = (updates) => {
    setState(s => {
      const ex = s.weeklyResults.find(w => w.wk === s.currentWeek) || {};
      const track = s.schedule.find(sc => sc.wk === s.currentWeek)?.track;
      const merged = { ...ex, wk: s.currentWeek, track, ...updates };
      return { ...s, weeklyResults: [...s.weeklyResults.filter(w => w.wk !== s.currentWeek), merged] };
    });
  };

  const setDriverPts = (num, val) => {
    const next = { ...driverPoints };
    if (val === '') delete next[num]; else next[num] = parseInt(val) || 0;
    patchWeek({ driverPoints: next });
  };
  const setBonus = (pid, val) => {
    const v = val === '' ? 0 : (parseInt(val) || 0);
    patchWeek({ bonuses: { ...bonuses, [pid]: v } });
  };
  const setOverride = (pid, val) => {
    const next = { ...overrides };
    if (val === '') delete next[pid]; else next[pid] = parseInt(val) || 0;
    patchWeek({ overrides: next });
  };

  const saveAndAdvance = () => {
    setState(s => {
      const ex = s.weeklyResults.find(w => w.wk === s.currentWeek) || {};
      const track = s.schedule.find(sc => sc.wk === s.currentWeek)?.track;
      const pts = {};
      s.players.forEach(p => {
        const nums = (s.draftState?.picks || []).filter(pk => pk.playerId === p.id).map(pk => pk.driverNum);
        const base = nums.reduce((sum, n) => sum + ((ex.driverPoints || {})[n] || 0), 0);
        const b = (ex.bonuses || {})[p.id] || 0;
        const o = (ex.overrides || {})[p.id];
        pts[p.id] = o != null ? o : (base + b);
      });
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

  const sorted = [...players].sort((a,b) => (totals[b.id] || 0) - (totals[a.id] || 0));
  const anyEntered = Object.keys(driverPoints).length > 0 || Object.keys(overrides).length > 0;

  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle={`Wk ${String(currentWeek).padStart(2,'0')} · ${currentRace?.track || ''}`} title="Results" right={<BackChip onClick={() => onNav('home')}/>}/>

    {/* Hero */}
    <div style={{ padding:'0 20px 16px' }}>
      <div style={{ background: T.ink, color: T.bg, borderRadius:4, padding:'18px 20px' }}>
        <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.24em', textTransform:'uppercase', color:'rgba(247,244,237,0.4)' }}>
          {isAdmin ? 'Commissioner Entry' : 'Waiting on Commissioner'}
        </div>
        <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:14, color:'rgba(247,244,237,0.75)', marginTop:8, lineHeight:1.5 }}>
          {isAdmin
            ? 'Enter each drafted driver\u2019s Cup points from nascar.com. Totals update live. Use Bonus for other-series drivers, Override to set a final number.'
            : `${admin.name} will enter driver points after the race.`}
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

    {isAdmin && anyEntered && <div style={{ padding:'0 20px 20px' }}>
      <button onClick={saveAndAdvance} style={{
        appearance:'none', width:'100%', padding:16,
        background: T.ink, color: T.bg, border:'none', borderRadius:3, cursor:'pointer',
        fontFamily: FL, fontSize:11, fontWeight:500,
        letterSpacing:'0.24em', textTransform:'uppercase',
      }}>Save & Advance to Week {String(currentWeek+1).padStart(2,'0')} →</button>
    </div>}
  </div>;
}
