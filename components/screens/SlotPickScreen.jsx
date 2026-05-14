'use client';
import React, { useState, useEffect } from 'react';
import { AllStarDraftPaused, BackChip, PlayerBadge, SectionLabel, TopBar } from '@/components/ui/primitives';
import { FB, FD, FI, FL, SERIES, T } from '@/lib/constants';
import { buildSlotPickOrder, getWeekConfig } from '@/lib/utils';

export default function SlotPickScreen({ state, setState, me, onNav, currentRace }) {
  const { players, weeklyResults, currentWeek, draftState } = state;
  // All-Star weeks suspend the draft. We MUST evaluate the all-star
  // branch only AFTER all hooks below have been called — otherwise the
  // hook count differs between regular and all-star renders, which
  // React forbids ("Rendered fewer hooks than expected"). So compute
  // the flag here and short-circuit at the JSX return below.
  const isAllStar = currentRace?.format === 'all-star';
  const cfg = getWeekConfig(state, currentWeek);
  const pickOrder = buildSlotPickOrder(players, weeklyResults, currentWeek - 1);
  const idx = draftState.slotPickIdx;
  const picker = pickOrder[idx];
  const taken = new Set(Object.values(draftState.slotAssign));

  const choose = (slot) => {
    if (taken.has(slot)) return;
    if (!picker || (picker.id !== me.id && me.id !== state.adminId)) return; // on-the-clock player or admin only
    const newAssign = { ...draftState.slotAssign, [picker.id]: slot };
    let next = idx + 1;
    let finalAssign = newAssign;
    // When 5 players have picked, auto-assign the last remaining slot to the top-ranked player
    if (next === players.length - 1) {
      const used = new Set(Object.values(newAssign));
      const leftover = Array.from({length: players.length}, (_, i) => i + 1).find(s => !used.has(s));
      const last = pickOrder[next];
      if (leftover && last && !newAssign[last.id]) {
        finalAssign = { ...newAssign, [last.id]: leftover };
        next = players.length;
      }
    }
    setState(s => ({
      ...s,
      draftState: {
        ...s.draftState,
        slotAssign: finalAssign,
        slotPickIdx: next,
        phase: next >= players.length ? 'ready' : 'slot-pick',
      }
    }));
  };

  const admin = players.find(p => p.id === state.adminId) || players[0];
  const isAdmin = me.id === admin.id;
  const allPicked = idx >= players.length;

  const [countdown, setCountdown] = useState(null);
  useEffect(() => {
    if (allPicked && draftState.phase === 'ready' && countdown == null) {
      setCountdown(3);
    }
  }, [allPicked, draftState.phase, countdown]);
  useEffect(() => {
    if (countdown == null) return;
    if (countdown <= 0) {
      try { navigator.vibrate?.([200, 80, 200]); } catch {}
      // Only flip the phase to 'snake'. Navigation is handled by the
      // phase-watcher effect in HarvestMoon (see slot→draft auto-nav),
      // which fires AFTER the state commit and is also what catches peers
      // observing the phase change via Supabase realtime. Calling onNav
      // imperatively here was racy: onNav closes over `screen` from the
      // parent render, so a realtime push that re-rendered the parent
      // mid-countdown could leave the league sitting on the slot screen.
      setState(s => ({ ...s, draftState: { ...s.draftState, phase: 'snake' } }));
      return;
    }
    try { navigator.vibrate?.(60); } catch {}
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Branch AFTER all hooks have run so the hook count stays stable
  // across regular/all-star renders (see comment near top).
  if (isAllStar) {
    return <AllStarDraftPaused state={state} me={me} currentRace={currentRace} onNav={onNav} screenLabel="Slot Pick"/>;
  }

  return <div style={{ paddingBottom: 20 }}>
    <TopBar
      subtitle="Step 1 of 2"
      title="Pick your Slot"
      right={<BackChip onClick={() => onNav('back')}/>}
    />

    <div style={{ padding:'0 20px 20px' }}>
      <div style={{ background: T.ink, color: T.bg, borderRadius:4, padding:'16px 18px', display:'flex', alignItems:'center', gap:14 }}>
        <PlayerBadge player={picker || me} size={38}/>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily: FL, fontSize:9, letterSpacing:'0.24em', textTransform:'uppercase', color:'rgba(247,244,237,0.5)' }}>On the Clock</div>
          <div style={{ fontFamily: FD, fontSize:24, fontWeight:600, letterSpacing:'-0.03em', marginTop:2, lineHeight:1 }}>{picker ? picker.name : 'All set'}</div>
        </div>
        <div style={{ fontFamily: FD, fontSize:20, fontStyle:'italic', color:'rgba(247,244,237,0.5)' }}>{idx}/{players.length}</div>
      </div>
    </div>

    {cfg.bonusSeries.length > 0 && <div style={{ padding:'0 20px 14px' }}>
      <div style={{
        background: T.card, border:`1px solid rgba(184,147,90,0.3)`, borderRadius:4,
        padding:'12px 14px',
      }}>
        <div style={{ fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.22em', textTransform:'uppercase', color: T.hot }}>Bonus Week</div>
        <div style={{ fontFamily: FB, fontSize:13, fontWeight:500, color: T.ink, marginTop:6, lineHeight:1.5 }}>
          Each player drafts {cfg.totalPicks} drivers this week — {Object.entries(cfg.allotments).map(([s, n]) => `${n} ${SERIES[s]?.label || s}`).join(' + ')}.
        </div>
      </div>
    </div>}

    <SectionLabel right={weeklyResults.length === 0
      ? <span style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, textTransform:'none', letterSpacing:'0.01em', color: T.mute }}>Week 1 · alphabetical</span>
      : null
    }>Pick Order · Lowest Points First</SectionLabel>
    <div style={{ padding:'14px 20px 24px' }}>
      {pickOrder.map((p, i, arr) => {
        const done = i < idx;
        const now = i === idx;
        return <div key={p.id} style={{
          display:'flex', alignItems:'center', gap:12,
          padding:'12px 0',
          borderBottom: i === arr.length-1 ? 'none' : `0.5px solid ${T.line2}`,
          opacity: done ? 0.4 : 1,
        }}>
          <div style={{ fontFamily: FD, fontSize:14, fontStyle:'italic', width:18, color: T.mute }}>{i+1}.</div>
          <PlayerBadge player={p} size={24}/>
          <div style={{ flex:1, fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em', color: now ? T.hot : T.ink }}>{p.name}</div>
          <div style={{ fontFamily: FB, fontSize:12, fontVariantNumeric:'tabular-nums', color: T.mute }}>{p.seasonPts} pts</div>
          {draftState.slotAssign[p.id] && <div style={{
            width:24, height:24, borderRadius:3,
            background: p.color, color:'#fff',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily: FL, fontWeight:600, fontSize:12,
          }}>{draftState.slotAssign[p.id]}</div>}
        </div>;
      })}
    </div>

    <SectionLabel>Available Slots</SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {Array.from({length: players.length}, (_,i) => i+1).map(slot => {
          const ta = taken.has(slot);
          const by = Object.entries(draftState.slotAssign).find(([,s]) => s === slot)?.[0];
          const byP = by ? players.find(p => p.id === by) : null;
          return <button key={slot} onClick={() => choose(slot)} disabled={ta} style={{
            appearance:'none', border:`0.5px solid ${ta ? T.line2 : T.line}`,
            background: ta ? 'transparent' : T.card,
            padding:'20px 16px', borderRadius:4,
            cursor: ta ? 'default' : 'pointer',
            textAlign:'left', opacity: ta ? 0.5 : 1,
          }}>
            <div style={{ fontFamily: FD, fontSize:60, fontWeight:600, lineHeight:0.9, color: T.ink, letterSpacing:'-0.04em' }}>{slot}</div>
            {ta && byP && <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:6 }}>
              <PlayerBadge player={byP} size={16}/>
              <span style={{ fontFamily: FB, fontSize:12, color: T.ink2 }}>{byP.name}</span>
            </div>}
          </button>;
        })}
      </div>
      {picker && picker.id === me.id && <div style={{
        marginTop:14, padding:'10px 14px',
        background:'rgba(184,147,90,0.10)', color: T.hot,
        fontFamily: FI, fontStyle:'italic', fontSize:13,
        borderRadius:3, textAlign:'center',
        border:`0.5px solid rgba(184,147,90,0.3)`,
      }}>It's your turn — tap a slot</div>}
    </div>

    {allPicked && <>
      <SectionLabel>Draft Starts</SectionLabel>
      <div style={{ padding:'14px 20px 30px', display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
        <div style={{
          fontSize: 64, lineHeight:1,
          filter: countdown === 0 ? 'drop-shadow(0 0 12px rgba(90,122,94,0.6))' : 'none',
          animation: countdown != null ? 'pulse 1s ease-in-out infinite' : 'none',
        }}>🏁</div>
        <div style={{
          fontFamily: FD, fontSize: countdown === 0 ? 56 : 72, fontWeight:700,
          color: countdown === 0 ? T.good : T.ink,
          letterSpacing:'-0.04em', lineHeight:1, fontVariantNumeric:'tabular-nums',
        }}>{countdown === 0 ? 'GO!' : (countdown ?? '3')}</div>
        <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:14, color: T.mute, textAlign:'center' }}>
          {countdown === 0 ? 'Green flag — heading to draft…' : 'All slots set. Draft starting.'}
        </div>
      </div>
    </>}
  </div>;
}
