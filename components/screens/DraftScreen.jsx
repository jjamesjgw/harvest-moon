'use client';
import React, { useState, useMemo } from 'react';
import { BackChip, CarNum, PlayerBadge, SectionLabel, TopBar } from '@/components/ui/primitives';
import { FD, FI, FL, ROUNDS_PER_WEEK, T } from '@/lib/constants';
import { buildSnakeOrder, makeDriverWeekData } from '@/lib/utils';

export default function DraftScreen({ state, setState, me, onNav }) {
  const { players, drivers, schedule, currentWeek, draftState, adminId } = state;
  const currentRace = schedule.find(s => s.wk === currentWeek);
  const isAdmin = me.id === adminId;
  const [layout, setLayout] = useState('grid'); // grid | list | snake
  const [search, setSearch] = useState('');
  const [numPad, setNumPad] = useState('');
  const [resetArm, setResetArm] = useState(false);

  const resetDraft = () => {
    if (!resetArm) { setResetArm(true); setTimeout(() => setResetArm(false), 3000); return; }
    setState(s => ({
      ...s,
      draftState: { phase:'slot-pick', slotPickIdx:0, slotAssign:{}, currentRound:1, picks:[] },
    }));
    setResetArm(false);
    onNav('slot');
  };

  // Stable per-week driver data (seeded)
  const weekDrivers = useMemo(() => makeDriverWeekData(drivers, currentWeek * 100 + drivers.length), [drivers, currentWeek]);

  const snakeOrder = buildSnakeOrder(players, draftState.slotAssign, ROUNDS_PER_WEEK);

  const pickIdx = draftState.picks.length;
  const totalPicks = ROUNDS_PER_WEEK * players.length;
  const done = pickIdx >= totalPicks;
  const onClock = done ? null : snakeOrder[pickIdx];
  const currentPicker = onClock ? players.find(p => p.id === onClock.playerId) : null;
  const myTurn = currentPicker && currentPicker.id === me.id;

  const pickedNums = new Set(draftState.picks.map(p => p.driverNum));

  const pick = (driver) => {
    if (done || pickedNums.has(driver.num) || !onClock) return;
    if (onClock.playerId !== me.id && me.id !== adminId) return; // on-the-clock player or admin only
    const newPicks = [...draftState.picks, {
      driverNum: driver.num, playerId: onClock.playerId,
      round: onClock.round, slot: onClock.slot, at: Date.now(),
    }];
    const nextRound = snakeOrder[newPicks.length]?.round || ROUNDS_PER_WEEK;
    const completing = newPicks.length >= totalPicks;
    setState(s => ({
      ...s,
      draftState: {
        ...s.draftState,
        picks: newPicks,
        currentRound: nextRound,
        phase: completing ? 'done' : 'snake',
      }
    }));
    setNumPad(''); setSearch('');
  };

  const undo = () => {
    if (pickIdx === 0) return;
    const newPicks = draftState.picks.slice(0, -1);
    setState(s => ({
      ...s,
      draftState: { ...s.draftState, picks: newPicks, phase: 'snake' }
    }));
  };

  const filtered = weekDrivers.filter(d => {
    if (numPad && !String(d.num).startsWith(numPad)) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return <div style={{ paddingBottom:20, display:'flex', flexDirection:'column', minHeight:'100%' }}>
    <div style={{ position:'sticky', top:0, zIndex:5, background: T.bg, paddingBottom:10 }}>
      <TopBar
        subtitle={`${currentRace.track} · Wk ${String(currentWeek).padStart(2,'0')}`}
        title="Draft"
        right={<BackChip onClick={() => onNav('home')} label="Exit"/>}
      />
      <div style={{ padding:'0 20px 4px' }}>
        <OnTheClock currentPicker={currentPicker} pickIdx={pickIdx} totalPicks={totalPicks} round={onClock?.round} myTurn={myTurn} done={done}/>
      </div>

      {!done && <div style={{ padding:'10px 20px 0', display:'flex', gap:6, justifyContent:'flex-end' }}>
        {pickIdx > 0 && (() => {
          const lastPick = draftState.picks[draftState.picks.length - 1];
          const canUndo = lastPick && (lastPick.playerId === me.id || me.id === adminId);
          if (!canUndo) return null;
          return <button onClick={undo} style={{
            appearance:'none',
            background:'transparent', color: T.mute,
            border: `0.5px solid ${T.line}`,
            padding:'7px 12px', borderRadius:3, cursor:'pointer',
            fontFamily: FL, fontSize:10, fontWeight:500,
            letterSpacing:'0.2em', textTransform:'uppercase',
          }}>↶ Undo my pick</button>;
        })()}
        {isAdmin && (pickIdx > 0 || Object.keys(draftState.slotAssign).length > 0) && <button onClick={resetDraft} style={{
          appearance:'none',
          background: resetArm ? T.hot : 'transparent',
          color: resetArm ? T.ink : T.hot,
          border: `0.5px solid ${T.hot}`,
          padding:'7px 12px', borderRadius:3, cursor:'pointer',
          fontFamily: FL, fontSize:10, fontWeight:500,
          letterSpacing:'0.2em', textTransform:'uppercase',
        }}>{resetArm ? 'Tap to confirm' : 'Reset'}</button>}
      </div>}
    </div>

    {!done && <DraftGrid drivers={filtered} pickedNums={pickedNums} draftState={draftState} players={players} currentRace={currentRace} onPick={pick} myTurn={myTurn} />}
    {!done && <div style={{ padding:'0 20px 24px' }}>
      <button onClick={() => onNav('drivers')} style={{
        appearance:'none', width:'100%',
        background:'transparent', border:`0.5px dashed ${T.line}`, borderRadius:8,
        padding:'14px',
        fontFamily: FL, fontSize:10, fontWeight:500,
        letterSpacing:'0.22em', textTransform:'uppercase', color: T.ink2, cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'center', gap:8,
      }}>
        <span style={{ fontSize:16, lineHeight:1, fontFamily: FD, fontWeight:300 }}>+</span>
        Add Driver
      </button>
    </div>}

    {done && <DraftComplete state={state} onNav={onNav} weekDrivers={weekDrivers} />}
  </div>;
}

function OnTheClock({ currentPicker, pickIdx, totalPicks, round, myTurn, done }) {
  if (done) return <div style={{ background: T.good, color:'#fff', borderRadius:4, padding:'16px 18px' }}>
    <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.24em', textTransform:'uppercase', color:'rgba(255,255,255,0.75)' }}>Draft Complete</div>
    <div style={{ fontFamily: FD, fontSize:24, fontWeight:600, letterSpacing:'-0.03em', marginTop:2 }}>Roll out the green flag</div>
  </div>;
  return <div style={{
    background: T.ink, color: T.bg, borderRadius:4, padding:'14px 18px',
    display:'flex', alignItems:'center', gap:14,
    border: myTurn ? `2px solid ${T.hot}` : 'none',
  }}>
    <PlayerBadge player={currentPicker} size={36}/>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.24em', textTransform:'uppercase', color: myTurn ? T.hot : 'rgba(247,244,237,0.5)' }}>
        {myTurn ? "You're up" : 'On the Clock'} · Round {round}
      </div>
      <div style={{ fontFamily: FD, fontSize:22, fontWeight:600, lineHeight:1.05, letterSpacing:'-0.03em', marginTop:2 }}>{currentPicker.name}</div>
    </div>
    <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:13, color:'rgba(247,244,237,0.55)', fontVariantNumeric:'tabular-nums' }}>{pickIdx+1}/{totalPicks}</div>
  </div>;
}

function DraftGrid({ drivers, pickedNums, draftState, players, currentRace, onPick, myTurn }) {
  return <div>
    <div style={{ height:14 }}/>
    <SectionLabel right={<span style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, textTransform:'none', letterSpacing:'0.01em', color: T.ink }}>{drivers.filter(d => !pickedNums.has(d.num)).length} available</span>}>Drivers · Tap to Pick</SectionLabel>
    <div style={{ padding:'12px 20px 16px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
        {drivers.map(d => {
          const taken = pickedNums.has(d.num);
          const takenBy = taken ? draftState.picks.find(p => p.driverNum === d.num) : null;
          const takenPl = takenBy ? players.find(p => p.id === takenBy.playerId) : null;
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
          }}>
            {/* Top livery accent bar */}
            {!taken && <div style={{
              position:'absolute', top:0, left:0, right:0, height:3,
              background: `linear-gradient(90deg, ${d.primary} 0%, ${d.primary} 60%, ${d.secondary || d.primary} 100%)`,
            }}/>}
            {/* Sheen overlay */}
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
          </button>;
        })}
      </div>
    </div>
  </div>;
}

function DraftComplete({ state, onNav, weekDrivers }) {
  const { players, drivers, draftState } = state;
  const byPlayer = {};
  draftState.picks.forEach(p => {
    (byPlayer[p.playerId] = byPlayer[p.playerId] || []).push(p);
  });
  return <div style={{ padding:'14px 20px 24px' }}>
    <SectionLabel>All Rosters</SectionLabel>
    <div style={{ marginTop:14 }}>
      {players.map((p, i) => (
        <div key={p.id} style={{
          padding:'14px 0',
          borderBottom: i === players.length-1 ? 'none' : `0.5px solid ${T.line2}`,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <PlayerBadge player={p} size={22}/>
            <span style={{ fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em' }}>{p.name}</span>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {(byPlayer[p.id] || []).map(pk => {
              const d = drivers.find(dv => dv.num === pk.driverNum);
              return d && <CarNum key={pk.driverNum} driver={d} size={32}/>;
            })}
          </div>
        </div>
      ))}
    </div>
    <div style={{ display:'flex', gap:8, marginTop:18 }}>
      <button onClick={() => onNav('team')} style={{
        appearance:'none', flex:1, padding:14,
        background: T.card, color: T.ink,
        border: `0.5px solid ${T.line}`, borderRadius:3, cursor:'pointer',
        fontFamily: FL, fontSize:11, fontWeight:500,
        letterSpacing:'0.22em', textTransform:'uppercase',
      }}>My Team</button>
      <button onClick={() => onNav('enter-results')} style={{
        appearance:'none', flex:1, padding:14,
        background: T.ink, color: T.bg, border:'none', borderRadius:3, cursor:'pointer',
        fontFamily: FL, fontSize:11, fontWeight:500,
        letterSpacing:'0.22em', textTransform:'uppercase',
      }}>Enter Results →</button>
    </div>
  </div>;
}
