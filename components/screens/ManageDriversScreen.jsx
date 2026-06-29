'use client';
import React, { useState } from 'react';
import { BackChip, CarNum, SectionLabel, TopBar } from '@/components/ui/primitives';
import { FB, FD, FI, FL, T } from '@/lib/constants';

// Generic "add a driver" form. Used for both Cup one-offs and bonus-series
// pools. Caller decides what scope to add to via `onAdd(driver)`.
function AddDriverForm({ onCancel, onAdd, existingNums = new Set(), title, history = [] }) {
  const [d, setD] = useState({ num:'', name:'', team:'', primary:'#14110D', secondary:'#F7F4ED' });
  const [err, setErr] = useState(null);
  const [expanded, setExpanded] = useState(false);
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

    {history.length > 0 && (() => {
      const visible = expanded ? history : history.slice(0, 6);
      const hidden = Math.max(0, history.length - 6);
      const prefill = (h) => {
        setD({
          num: String(h.num),
          name: h.name,
          team: h.team === '—' ? '' : h.team,
          primary: h.primary,
          secondary: h.secondary,
        });
        setErr(null);
      };
      return <>
        <div style={{ fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.22em', textTransform:'uppercase', color: T.mute, marginTop:2 }}>From past weeks</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {visible.map(h => (
            <button
              key={h.num}
              type="button"
              onClick={() => prefill(h)}
              style={{
                appearance:'none',
                background: T.card,
                border: `1px solid ${T.line}`,
                borderRadius: 3,
                padding: '6px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                color: T.ink,
              }}
            >
              <CarNum driver={h} size={22}/>
              <span style={{ fontFamily: FD, fontSize: 13, fontWeight: 600, letterSpacing: '-0.02em' }}>{h.name}</span>
            </button>
          ))}
          {!expanded && hidden > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              style={{
                appearance:'none',
                background: T.card,
                border: `1px solid ${T.line}`,
                borderRadius: 3,
                padding: '6px 10px',
                cursor: 'pointer',
                fontFamily: FL, fontSize: 10, fontWeight: 600,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: T.mute,
              }}
            >+ {hidden} more</button>
          )}
        </div>
        <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, color: T.mute, marginTop:2 }}>or enter a brand-new driver</div>
      </>;
    })()}

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
    {err && <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.danger, padding:'6px 2px 0', lineHeight:1.4 }}>{err}</div>}
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
  const isAdmin = !!me?.isAdmin;
  const currentRace = schedule.find(s => s.wk === currentWeek);
  const wkExtras = (state.weekDriversExtra || {})[currentWeek] || [];
  const extraNums = new Set(wkExtras.map(d => d.num));

  const [adding, setAdding] = useState(false);
  const [removeArm, setRemoveArm] = useState(null); // string key 'cup:7' or 'Truck:7'

  // Scope to the current week — part-time drivers from prior weeks
  // (in weekDriversExtra) must remain re-addable when they run again.
  const currentCupNums = new Set(drivers.map(d => d.num));

  // History of every past one-off Cup driver, dedup'd by car number with
  // the most-recent entry winning, filtered to numbers not already on
  // this week's roster. Surfaced as a tap-to-prefill picker in the Add form.
  const cupHistory = (() => {
    const byNum = new Map();
    const weeksDesc = Object.keys(state.weekDriversExtra || {})
      .map(Number)
      .filter(n => Number.isFinite(n) && n !== currentWeek)
      .sort((a, b) => b - a);
    for (const wk of weeksDesc) {
      for (const driver of ((state.weekDriversExtra || {})[wk] || [])) {
        if (byNum.has(driver.num)) continue;
        if (currentCupNums.has(driver.num)) continue;
        byNum.set(driver.num, { ...driver, lastSeenWeek: wk });
      }
    }
    return Array.from(byNum.values());
  })();

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
          existingNums={currentCupNums}
          history={cupHistory}
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
