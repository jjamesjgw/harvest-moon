'use client';
import React, { useState } from 'react';
import { BackChip, CarNum, SectionLabel, TopBar } from '@/components/ui/primitives';
import { FB, FD, FI, FL, T } from '@/lib/constants';

export default function ManageDriversScreen({ state, setState, onBack }) {
  const { drivers, currentWeek, schedule } = state;
  const currentRace = schedule.find(s => s.wk === currentWeek);
  const wkExtras = (state.weekDriversExtra || {})[currentWeek] || [];
  const extraNums = new Set(wkExtras.map(d => d.num));
  const [adding, setAdding] = useState(false);
  const [newD, setNewD] = useState({ num:'', name:'', team:'', primary:'#14110D', secondary:'#F7F4ED' });
  const [addError, setAddError] = useState(null);
  const [removeArm, setRemoveArm] = useState(null); // num armed for removal

  // Numbers that already exist anywhere in the league — across DEFAULT_DRIVERS
  // (current week) AND every other week's one-off pool. Prevents adding a
  // duplicate that would later collide when the schedule reaches that week.
  const allUsedNums = new Set([
    ...drivers.map(d => d.num),
    ...Object.values(state.weekDriversExtra || {}).flat().map(d => d.num),
  ]);

  const remove = (num) => {
    if (!extraNums.has(num)) return; // cannot remove defaults
    if (removeArm !== num) {
      setRemoveArm(num);
      setTimeout(() => setRemoveArm(a => a === num ? null : a), 3000);
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
  const add = () => {
    setAddError(null);
    const n = parseInt(newD.num, 10);
    const name = newD.name.trim();
    const team = newD.team.trim();
    if (!Number.isFinite(n) || n < 0 || n > 999) {
      setAddError('Car number must be 0–999.');
      return;
    }
    if (!name) {
      setAddError('Driver name is required.');
      return;
    }
    if (name.length > 24) {
      setAddError('Driver name must be 24 characters or fewer.');
      return;
    }
    if (allUsedNums.has(n)) {
      setAddError(`#${n} is already in the league this season.`);
      return;
    }
    if (newD.primary.toLowerCase() === newD.secondary.toLowerCase()) {
      setAddError('Primary and secondary livery colors must differ.');
      return;
    }
    const driver = {
      num: n, name, team: team || '—',
      primary: newD.primary, secondary: newD.secondary,
    };
    setState(s => ({
      ...s,
      drivers: [...s.drivers, driver].sort((a,b) => a.num - b.num),
      weekDriversExtra: {
        ...(s.weekDriversExtra || {}),
        [s.currentWeek]: [...((s.weekDriversExtra || {})[s.currentWeek] || []), driver],
      },
    }));
    setNewD({ num:'', name:'', team:'', primary:'#14110D', secondary:'#F7F4ED' });
    setAdding(false);
  };

  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle={`Wk ${String(currentWeek).padStart(2,'0')} · ${currentRace?.track || ''}`} title="Drivers" right={<BackChip onClick={onBack}/>}/>

    <div style={{ padding:'0 20px 14px' }}>
      <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:13, color: T.mute, lineHeight:1.5, marginBottom:14 }}>
        Add one-off drivers only running this week (e.g. Jimmie Johnson at the Daytona 500). They're available in this week's draft and saved to history/results, but the pool resets to the 36 full-timers next week.
      </div>
      {!adding ? (
        <button onClick={() => setAdding(true)} style={{
          appearance:'none', width:'100%',
          background:'transparent', border:`0.5px dashed ${T.line}`, borderRadius:3,
          padding:'14px',
          fontFamily: FL, fontSize:10, fontWeight:500,
          letterSpacing:'0.2em', textTransform:'uppercase', color: T.ink, cursor:'pointer',
        }}>+ Add One-Off Driver for Wk {String(currentWeek).padStart(2,'0')}</button>
      ) : (
        <div style={{ borderTop:`0.5px solid ${T.line}`, borderBottom:`0.5px solid ${T.line}`, padding:'14px 0', display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ display:'flex', gap:6 }}>
            <input value={newD.num} onChange={e => setNewD({...newD, num: e.target.value})} placeholder="#" maxLength={3}
              style={{ width:54, padding:10, borderRadius:3, border:`0.5px solid ${T.line}`, background: T.card, fontFamily: FB, fontSize:15, fontWeight:600, textAlign:'center', outline:'none', color: T.ink }}/>
            <input value={newD.name} onChange={e => setNewD({...newD, name: e.target.value})} placeholder="Driver name"
              style={{ flex:1, padding:'10px 12px', borderRadius:3, border:`0.5px solid ${T.line}`, background: T.card, fontFamily: FB, fontSize:14, outline:'none', color: T.ink }}/>
          </div>
          <input value={newD.team} onChange={e => setNewD({...newD, team: e.target.value})} placeholder="Team"
            style={{ padding:'10px 12px', borderRadius:3, border:`0.5px solid ${T.line}`, background: T.card, fontFamily: FB, fontSize:14, outline:'none', color: T.ink }}/>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <label style={{ fontFamily: FL, fontSize:10, color: T.mute, letterSpacing:'0.18em', textTransform:'uppercase' }}>Livery</label>
            <input type="color" value={newD.primary} onChange={e => setNewD({...newD, primary: e.target.value})} style={{ width:36, height:36, border:'none', background:'transparent', cursor:'pointer' }}/>
            <input type="color" value={newD.secondary} onChange={e => setNewD({...newD, secondary: e.target.value})} style={{ width:36, height:36, border:'none', background:'transparent', cursor:'pointer' }}/>
            <div style={{ flex:1 }}/>
            <button onClick={() => { setAdding(false); setAddError(null); setNewD({ num:'', name:'', team:'', primary:'#14110D', secondary:'#F7F4ED' }); }} style={{
              appearance:'none', background:'transparent', color: T.ink,
              border:`0.5px solid ${T.line}`, borderRadius:3, padding:'10px 14px',
              fontFamily: FL, fontSize:10, fontWeight:500, letterSpacing:'0.2em', textTransform:'uppercase', cursor:'pointer',
            }}>Cancel</button>
            <button onClick={add} style={{
              appearance:'none', background: T.ink, color: T.bg,
              border:'none', borderRadius:3, padding:'10px 14px',
              fontFamily: FL, fontSize:10, fontWeight:500, letterSpacing:'0.2em', textTransform:'uppercase', cursor:'pointer',
            }}>Add</button>
          </div>
          {addError && <div style={{
            fontFamily: FI, fontStyle:'italic', fontSize:12, color:'#C8102E',
            padding:'6px 2px 0', lineHeight:1.4,
          }}>{addError}</div>}
        </div>
      )}
    </div>

    <SectionLabel right={<span style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, textTransform:'none', letterSpacing:'0.01em', color: T.mute }}>{drivers.length} this week</span>}>Entry List</SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      {[...drivers].sort((a,b) => a.num - b.num).map((d, i) => {
        const isExtra = extraNums.has(d.num);
        return <div key={d.num} style={{
          display:'flex', alignItems:'center', gap:12,
          padding:'12px 0',
          borderBottom: i === drivers.length-1 ? 'none' : `0.5px solid ${T.line2}`,
        }}>
          <CarNum driver={d} size={34}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily: FD, fontSize:17, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1.1 }}>{d.name}</div>
            <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute, marginTop:3 }}>
              № {d.num} · {d.team}{isExtra ? <span style={{ color: T.hot, marginLeft:6 }}>· one-off</span> : ''}
            </div>
          </div>
          {isExtra && <button onClick={() => remove(d.num)} style={{
            appearance:'none',
            border:`0.5px solid ${removeArm === d.num ? T.hot : T.line}`,
            background: removeArm === d.num ? T.hot : 'transparent',
            color: removeArm === d.num ? T.bg : T.mute,
            padding:'7px 10px', borderRadius:3, cursor:'pointer',
            fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.18em', textTransform:'uppercase',
          }}>{removeArm === d.num ? 'Confirm' : 'Remove'}</button>}
        </div>;
      })}
    </div>
  </div>;
}
