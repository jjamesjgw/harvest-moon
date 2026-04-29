'use client';
import React, { useState } from 'react';
import { BackChip, CarNum, SectionLabel, TopBar } from '@/components/ui/primitives';
import { ADMIN_ID, BONUS_SERIES_IDS, FB, FD, FI, FL, SERIES, T } from '@/lib/constants';
import { getWeekConfig } from '@/lib/utils';

// Generic "add a driver" form. Used for both Cup one-offs and bonus-series
// pools. Caller decides what scope to add to via `onAdd(driver)`.
function AddDriverForm({ onCancel, onAdd, existingNums = new Set(), title }) {
  const [d, setD] = useState({ num:'', name:'', team:'', primary:'#14110D', secondary:'#F7F4ED' });
  const [err, setErr] = useState(null);
  const submit = () => {
    setErr(null);
    const n = parseInt(d.num, 10);
    const name = d.name.trim();
    if (!Number.isFinite(n) || n < 0 || n > 999) return setErr('Car number must be 0–999.');
    if (!name) return setErr('Driver name is required.');
    if (name.length > 24) return setErr('Driver name must be 24 characters or fewer.');
    if (existingNums.has(n)) return setErr(`#${n} is already in this pool.`);
    if (d.primary.toLowerCase() === d.secondary.toLowerCase()) return setErr('Primary and secondary livery colors must differ.');
    onAdd({ num: n, name, team: d.team.trim() || '—', primary: d.primary, secondary: d.secondary });
  };
  return <div style={{ borderTop:`0.5px solid ${T.line}`, borderBottom:`0.5px solid ${T.line}`, padding:'14px 0', display:'flex', flexDirection:'column', gap:8 }}>
    {title && <div style={{ fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.22em', textTransform:'uppercase', color: T.hot, marginBottom:2 }}>{title}</div>}
    <div style={{ display:'flex', gap:6 }}>
      <input value={d.num} onChange={e => setD({...d, num: e.target.value})} placeholder="#" maxLength={3}
        style={{ width:54, padding:10, borderRadius:3, border:`1px solid ${T.line}`, background: T.card, fontFamily: FB, fontSize:15, fontWeight:600, textAlign:'center', outline:'none', color: T.ink }}/>
      <input value={d.name} onChange={e => setD({...d, name: e.target.value})} placeholder="Driver name"
        style={{ flex:1, padding:'10px 12px', borderRadius:3, border:`1px solid ${T.line}`, background: T.card, fontFamily: FB, fontSize:14, outline:'none', color: T.ink }}/>
    </div>
    <input value={d.team} onChange={e => setD({...d, team: e.target.value})} placeholder="Team (optional)"
      style={{ padding:'10px 12px', borderRadius:3, border:`1px solid ${T.line}`, background: T.card, fontFamily: FB, fontSize:14, outline:'none', color: T.ink }}/>
    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
      <label style={{ fontFamily: FL, fontSize:10, color: T.mute, letterSpacing:'0.18em', textTransform:'uppercase' }}>Livery</label>
      <input type="color" value={d.primary} onChange={e => setD({...d, primary: e.target.value})} style={{ width:36, height:36, border:'none', background:'transparent', cursor:'pointer' }}/>
      <input type="color" value={d.secondary} onChange={e => setD({...d, secondary: e.target.value})} style={{ width:36, height:36, border:'none', background:'transparent', cursor:'pointer' }}/>
      <div style={{ flex:1 }}/>
      <button onClick={onCancel} style={{
        appearance:'none', background: T.card, color: T.ink,
        border:`1px solid ${T.line}`, borderRadius:3, padding:'10px 14px',
        fontFamily: FL, fontSize:10, fontWeight:600, letterSpacing:'0.2em', textTransform:'uppercase', cursor:'pointer',
      }}>Cancel</button>
      <button onClick={submit} style={{
        appearance:'none', background: T.ink, color: T.bg,
        border:'none', borderRadius:3, padding:'10px 14px',
        fontFamily: FL, fontSize:10, fontWeight:600, letterSpacing:'0.2em', textTransform:'uppercase', cursor:'pointer',
      }}>Add</button>
    </div>
    {err && <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color:'#C8102E', padding:'6px 2px 0', lineHeight:1.4 }}>{err}</div>}
  </div>;
}

// One row in either driver list — chip + name + team + remove button.
function DriverRow({ driver, isExtra, removeArm, onRemove, onTryRemove, last }) {
  return <div style={{
    display:'flex', alignItems:'center', gap:12,
    padding:'12px 0',
    borderBottom: last ? 'none' : `0.5px solid ${T.line2}`,
  }}>
    <CarNum driver={driver} size={34}/>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontFamily: FD, fontSize:17, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1.1 }}>{driver.name}</div>
      <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute, marginTop:3 }}>
        № {driver.num} · {driver.team}{isExtra ? <span style={{ color: T.hot, marginLeft:6 }}>· one-off</span> : ''}
      </div>
    </div>
    {isExtra && <button onClick={onTryRemove} style={{
      appearance:'none',
      background: removeArm ? T.hot : T.card,
      color: removeArm ? T.bg : T.ink,
      border:`1px solid ${removeArm ? T.hot : T.line}`,
      padding:'7px 10px', borderRadius:3, cursor:'pointer',
      fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.18em', textTransform:'uppercase',
    }}>{removeArm ? 'Confirm' : 'Remove'}</button>}
  </div>;
}

export default function ManageDriversScreen({ state, setState, me, onBack }) {
  const { drivers, currentWeek, schedule } = state;
  const isAdmin = me?.id === ADMIN_ID;
  const currentRace = schedule.find(s => s.wk === currentWeek);
  const wkExtras = (state.weekDriversExtra || {})[currentWeek] || [];
  const extraNums = new Set(wkExtras.map(d => d.num));
  const cfg = getWeekConfig(state, currentWeek);

  const [adding, setAdding] = useState(false);
  const [bonusAdding, setBonusAdding] = useState(null); // series id when adding to a bonus pool
  const [removeArm, setRemoveArm] = useState(null); // string key 'cup:7' or 'Truck:7'

  const allCupNums = new Set([
    ...drivers.map(d => d.num),
    ...Object.values(state.weekDriversExtra || {}).flat().map(d => d.num),
  ]);

  // ── Cup one-offs ──
  const removeCupExtra = (num) => {
    const armKey = `Cup:${num}`;
    if (!extraNums.has(num)) return;
    if (removeArm !== armKey) {
      setRemoveArm(armKey);
      setTimeout(() => setRemoveArm(a => a === armKey ? null : a), 3000);
      return;
    }
    setRemoveArm(null);
    setState(s => ({
      ...s,
      drivers: s.drivers.filter(d => d.num !== num),
      weekDriversExtra: {
        ...(s.weekDriversExtra || {}),
        [s.currentWeek]: ((s.weekDriversExtra || {})[s.currentWeek] || []).filter(d => d.num !== num),
      },
    }));
  };
  const addCupExtra = (driver) => {
    setState(s => ({
      ...s,
      drivers: [...s.drivers, driver].sort((a, b) => a.num - b.num),
      weekDriversExtra: {
        ...(s.weekDriversExtra || {}),
        [s.currentWeek]: [...((s.weekDriversExtra || {})[s.currentWeek] || []), driver],
      },
    }));
    setAdding(false);
  };

  // ── Bonus pool helpers ──
  const bonusPool = (series) => state.bonusDriversByWeek?.[currentWeek]?.[series] || [];
  const removeBonus = (series, num) => {
    const armKey = `${series}:${num}`;
    if (removeArm !== armKey) {
      setRemoveArm(armKey);
      setTimeout(() => setRemoveArm(a => a === armKey ? null : a), 3000);
      return;
    }
    setRemoveArm(null);
    setState(s => ({
      ...s,
      bonusDriversByWeek: {
        ...(s.bonusDriversByWeek || {}),
        [s.currentWeek]: {
          ...((s.bonusDriversByWeek || {})[s.currentWeek] || {}),
          [series]: ((s.bonusDriversByWeek || {})[s.currentWeek] || {})[series]?.filter(d => d.num !== num) || [],
        },
      },
    }));
  };
  const addBonus = (series, driver) => {
    setState(s => {
      const wk = s.currentWeek;
      const byWeek = s.bonusDriversByWeek || {};
      const wkPools = byWeek[wk] || {};
      const seriesPool = [...(wkPools[series] || []), driver].sort((a, b) => a.num - b.num);
      return {
        ...s,
        bonusDriversByWeek: {
          ...byWeek,
          [wk]: { ...wkPools, [series]: seriesPool },
        },
      };
    });
    setBonusAdding(null);
  };

  if (!isAdmin) {
    return <div style={{ paddingBottom:20 }}>
      <TopBar subtitle="Admin only" title="Drivers" right={<BackChip onClick={onBack}/>}/>
      <div style={{ padding:'40px 28px', textAlign:'center' }}>
        <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:15, color: T.mute, lineHeight:1.5 }}>
          Driver management is restricted to the commissioner.
        </div>
      </div>
    </div>;
  }

  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle={`Wk ${String(currentWeek).padStart(2,'0')} · ${currentRace?.track || ''}`} title="Manage Drivers" right={<BackChip onClick={onBack}/>}/>

    {/* Bonus pools — only render if this week has bonus rounds configured */}
    {cfg.bonusSeries.length > 0 && <>
      <div style={{ padding:'14px 20px 0' }}>
        <div style={{
          background: T.card, border:`1px solid rgba(184,147,90,0.3)`, borderRadius:4,
          padding:'12px 14px',
        }}>
          <div style={{ fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.22em', textTransform:'uppercase', color: T.hot }}>Bonus Week</div>
          <div style={{ fontFamily: FB, fontSize:13, fontWeight:500, color: T.ink, marginTop:6, lineHeight:1.5 }}>
            Add eligible drivers for each bonus series before the draft starts. Each player will pick {Object.entries(cfg.allotments).map(([s, n]) => `${n} ${SERIES[s]?.label || s}`).join(' + ')}.
          </div>
        </div>
      </div>

      {cfg.bonusSeries.map(series => {
        const pool = bonusPool(series);
        const meta = SERIES[series] || { label: series };
        const usedNums = new Set(pool.map(d => d.num));
        return <div key={series}>
          <SectionLabel right={<span style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, textTransform:'none', letterSpacing:'0.01em', color: T.mute }}>{pool.length} driver{pool.length === 1 ? '' : 's'}</span>}>
            {meta.label} Pool
          </SectionLabel>
          <div style={{ padding:'14px 20px 16px' }}>
            {bonusAdding === series ? (
              <AddDriverForm
                title={`New ${meta.label} driver`}
                existingNums={usedNums}
                onCancel={() => setBonusAdding(null)}
                onAdd={(d) => addBonus(series, d)}
              />
            ) : (
              <button onClick={() => setBonusAdding(series)} style={{
                appearance:'none', width:'100%',
                background: T.ink, color: T.bg,
                border:'none', borderRadius:3,
                padding:'12px',
                fontFamily: FL, fontSize:10, fontWeight:600,
                letterSpacing:'0.2em', textTransform:'uppercase', cursor:'pointer',
              }}>+ Add {meta.label} Driver</button>
            )}
            {pool.length > 0 && <div style={{ marginTop:10 }}>
              {pool.map((d, i) => (
                <DriverRow
                  key={d.num} driver={d} isExtra
                  removeArm={removeArm === `${series}:${d.num}`}
                  onTryRemove={() => removeBonus(series, d.num)}
                  last={i === pool.length-1}
                />
              ))}
            </div>}
            {pool.length === 0 && bonusAdding !== series && <div style={{
              fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute,
              marginTop:10, lineHeight:1.5,
            }}>
              No {meta.label} drivers added yet. The league won't be able to make a {meta.label} pick until you add at least one.
            </div>}
          </div>
        </div>;
      })}
    </>}

    {/* Cup pool (default 36 + one-offs) */}
    <SectionLabel right={<span style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, textTransform:'none', letterSpacing:'0.01em', color: T.mute }}>{drivers.length} this week</span>}>Cup Entry List</SectionLabel>
    <div style={{ padding:'14px 20px 4px' }}>
      <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:13, color: T.mute, lineHeight:1.5, marginBottom:14 }}>
        Add one-off Cup drivers only running this week (e.g. Jimmie Johnson at the Daytona 500). They're available in this week's draft and saved to history, but the pool resets to the 36 full-timers next week.
      </div>
      {!adding ? (
        <button onClick={() => setAdding(true)} style={{
          appearance:'none', width:'100%',
          background: T.ink, color: T.bg,
          border:'none', borderRadius:3,
          padding:'12px',
          fontFamily: FL, fontSize:10, fontWeight:600,
          letterSpacing:'0.2em', textTransform:'uppercase', cursor:'pointer',
        }}>+ Add One-Off Cup Driver for Wk {String(currentWeek).padStart(2,'0')}</button>
      ) : (
        <AddDriverForm
          title={`New Cup driver for Wk ${String(currentWeek).padStart(2,'0')}`}
          existingNums={allCupNums}
          onCancel={() => setAdding(false)}
          onAdd={addCupExtra}
        />
      )}
    </div>

    <div style={{ padding:'14px 20px 20px' }}>
      {[...drivers].sort((a, b) => a.num - b.num).map((d, i) => (
        <DriverRow
          key={d.num} driver={d}
          isExtra={extraNums.has(d.num)}
          removeArm={removeArm === `Cup:${d.num}`}
          onTryRemove={() => removeCupExtra(d.num)}
          last={i === drivers.length-1}
        />
      ))}
    </div>
  </div>;
}
