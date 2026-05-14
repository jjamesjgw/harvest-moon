'use client';
import React, { useEffect, useRef, useState } from 'react';
import { MenuRow, SectionLabel, TopBar } from '@/components/ui/primitives';
import { FB, FD, FI, FL, FM, ROUNDS_PER_WEEK, T } from '@/lib/constants';

// Trigger a JSON download of the full league state. Used by the admin to
// keep a local snapshot outside Supabase as insurance against accidental
// resets or cloud outages.
function downloadLeagueBackup(state) {
  if (typeof window === 'undefined' || !state) return;
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `harvest-moon-${stamp}-wk${String(state.currentWeek || 0).padStart(2, '0')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// Type-to-confirm modal for Reset Season. The previous "tap-arm-tap-confirm"
// pattern was the same affordance as every other menu row and could be
// triggered with two reflexive taps. After 11 production weeks of accumulated
// state, an accidental reset would be a real catastrophe — so we gate the
// destructive action behind typing the literal word RESET. Mirrors the
// industry-standard pattern (GitHub repo deletion, Stripe, etc.).
function ConfirmResetModal({ state, onCancel, onConfirm }) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef(null);

  // Auto-focus the input on mount + lock body scroll while the modal is up.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    if (typeof document !== 'undefined') {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
        clearTimeout(t);
      };
    }
    return () => clearTimeout(t);
  }, []);

  const armed = typed.trim().toUpperCase() === 'RESET';
  const weeksLost = (state.weeklyResults || []).length;
  const draftsLost = (state.draftHistory || []).length;

  return <div style={{
    position:'fixed', inset:0, zIndex:1000,
    background:'rgba(10,8,6,0.74)',
    display:'flex', alignItems:'center', justifyContent:'center',
    padding:'env(safe-area-inset-top) 20px env(safe-area-inset-bottom)',
    backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)',
  }}>
    <div style={{
      width:'100%', maxWidth:380,
      background: T.bg, borderRadius:8,
      border:`1px solid ${T.line}`,
      boxShadow:'0 20px 60px rgba(0,0,0,0.5)',
      overflow:'hidden',
    }}>
      <div style={{
        background:'linear-gradient(180deg, #C8102E 0%, #A40D24 100%)',
        color:'#fff', padding:'16px 20px',
      }}>
        <div style={{
          fontFamily: FL, fontSize:9, fontWeight:700,
          letterSpacing:'0.28em', textTransform:'uppercase',
          color:'rgba(255,255,255,0.78)',
        }}>Danger · Irreversible</div>
        <div style={{ fontFamily: FD, fontSize:24, fontWeight:600, letterSpacing:'-0.03em', marginTop:4 }}>Reset the season?</div>
      </div>
      <div style={{ padding:'18px 20px 20px' }}>
        <div style={{ fontFamily: FB, fontSize:14, color: T.ink, lineHeight:1.55 }}>
          This will permanently delete <strong>{weeksLost} completed week{weeksLost === 1 ? '' : 's'}</strong> of results
          and <strong>{draftsLost} draft{draftsLost === 1 ? '' : 's'}</strong> of picks.
          Standings, history, and per-driver stats will all reset to zero.
        </div>
        <div style={{ marginTop:14, fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute, lineHeight:1.5 }}>
          Type <span style={{ fontFamily: FM, color: T.ink, background: 'rgba(20,17,13,0.06)', padding:'1px 5px', borderRadius:2 }}>RESET</span> below to confirm.
        </div>
        <input ref={inputRef} value={typed}
          onChange={e => setTyped(e.target.value)}
          autoCapitalize="characters" autoCorrect="off" spellCheck={false}
          placeholder="RESET"
          style={{
            width:'100%', boxSizing:'border-box', marginTop:10,
            padding:'12px 14px',
            background: T.card,
            border:`1px solid ${armed ? '#C8102E' : T.line}`,
            borderRadius:4, outline:'none',
            fontFamily: FM, fontSize:18, fontWeight:600,
            letterSpacing:'0.18em', color: T.ink, textAlign:'center',
            textTransform:'uppercase',
          }}/>
        <div style={{ display:'flex', gap:8, marginTop:14 }}>
          <button onClick={onCancel} style={{
            appearance:'none', flex:1, padding:14,
            background: T.card, color: T.ink,
            border:`1px solid ${T.line}`, borderRadius:3, cursor:'pointer',
            fontFamily: FL, fontSize:11, fontWeight:600,
            letterSpacing:'0.22em', textTransform:'uppercase',
          }}>Cancel</button>
          <button onClick={onConfirm} disabled={!armed} style={{
            appearance:'none', flex:1, padding:14,
            background: armed ? '#C8102E' : 'rgba(200,16,46,0.25)',
            color:'#fff',
            border:'none', borderRadius:3,
            cursor: armed ? 'pointer' : 'default',
            fontFamily: FL, fontSize:11, fontWeight:600,
            letterSpacing:'0.22em', textTransform:'uppercase',
            transition:'background 200ms ease',
          }}>Reset Season</button>
        </div>
      </div>
    </div>
  </div>;
}

export default function MoreScreen({ state, me, onNav, onReset, onSignOut }) {
  const { schedule, currentWeek, weeklyResults, adminId } = state;
  // Clone before sort: Array.prototype.sort mutates in place, and weeklyResults
  // is shared React state — sorting it directly reorders the live array.
  const lastResult = [...weeklyResults].sort((a,b) => b.wk - a.wk)[0];
  const isAdmin = me.id === adminId;
  const [resetOpen, setResetOpen] = useState(false);

  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle="League · Settings" title="More"/>

    <SectionLabel>Profile</SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      <MenuRow label="My Profile" sub="Nickname, color, favorite driver" onClick={() => onNav('profile')} last/>
    </div>

    <SectionLabel>League</SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      <MenuRow label="Schedule" sub={`${schedule.length} races · Wk ${currentWeek} of ${schedule.length}`} onClick={() => onNav('schedule')}/>
      <MenuRow label="Draft History" sub={isAdmin ? `${weeklyResults.length} past week${weeklyResults.length === 1 ? '' : 's'} · tap to view or edit` : `${weeklyResults.length} past week${weeklyResults.length === 1 ? '' : 's'}`} onClick={() => onNav('history')}/>
      <MenuRow label="Drivers" sub="League-wide stats & per-driver breakdowns" onClick={() => onNav('drivers')}/>
      <MenuRow label="Last Race Recap" sub={lastResult ? lastResult.track : 'No results yet'} onClick={() => onNav('recap')} last/>
    </div>

    <SectionLabel>Settings</SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      <MenuRow label="Rules" sub={`${ROUNDS_PER_WEEK} drivers/week · Snake`} onClick={() => onNav('rules')}/>
      <MenuRow label="Sign Out" sub="Return to league login" onClick={onSignOut} last/>
    </div>

    {isAdmin && <>
      <SectionLabel>Admin Tools</SectionLabel>
      <div style={{ padding:'14px 20px 20px' }}>
        <MenuRow label="Manage Drivers" sub="Cup one-offs + bonus pools" onClick={() => onNav('manage-drivers')}/>
        <MenuRow label="Download Backup" sub="Save the full league state as JSON to your device" onClick={() => downloadLeagueBackup(state)} last/>
      </div>
      <SectionLabel>Danger Zone</SectionLabel>
      <div style={{ padding:'14px 20px 40px' }}>
        <MenuRow label="Reset Season" sub="Erase all results & drafts — type-to-confirm" onClick={() => setResetOpen(true)} last/>
      </div>
    </>}

    {resetOpen && <ConfirmResetModal
      state={state}
      onCancel={() => setResetOpen(false)}
      onConfirm={() => { setResetOpen(false); onReset(); }}
    />}
  </div>;
}
