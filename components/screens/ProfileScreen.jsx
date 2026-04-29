'use client';
import React from 'react';
import { BackChip, CarNum, Field, MenuRow, PlayerBadge, SectionLabel, TopBar } from '@/components/ui/primitives';
import { ADMIN_ID, FB, FD, FI, FL, T } from '@/lib/constants';
import { DEFAULT_DRIVERS } from '@/lib/data';
import { computeStandings } from '@/lib/utils';

export default function ProfileScreen({ state, setState, me, onBack }) {
  const isAdmin = me.id === ADMIN_ID;
  const update = (field, val) => {
    if (isAdmin) return;
    setState(s => ({
      ...s,
      players: s.players.map(p => p.id === me.id
        ? { ...p, [field]: val, initial: field === 'name' ? (val[0] || p.initial).toUpperCase() : p.initial }
        : p),
    }));
  };

  const { weeklyResults, currentWeek } = state;
  const mePts = isAdmin ? null : computeStandings(state.players, weeklyResults, currentWeek - 1).find(p => p.id === me.id);

  if (isAdmin) {
    return <div style={{ paddingBottom:20 }}>
      <TopBar subtitle="Commissioner controls" title="Admin" right={<BackChip onClick={onBack}/>}/>
      <div style={{ padding:'0 20px 20px' }}>
        <div style={{
          background: T.ink, color: T.bg, borderRadius:4, padding:'22px 20px',
          display:'flex', alignItems:'center', gap:16,
        }}>
          <PlayerBadge player={me} size={64}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily: FD, fontSize:28, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1 }}>Admin</div>
            <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:13, color:'rgba(247,244,237,0.6)', marginTop:8, lineHeight:1.5 }}>
              You can pick on behalf of any player, reset drafts, manage drivers, enter results, and reset the season.
            </div>
          </div>
        </div>
      </div>
      <SectionLabel>Quick Actions</SectionLabel>
      <div style={{ padding:'14px 20px 24px' }}>
        <MenuRow label="Manage Drivers" sub="Edit one-off entries" onClick={() => onBack()} last/>
      </div>
    </div>;
  }

  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle="Your identity in the league" title="Profile" right={<BackChip onClick={onBack}/>}/>

    {/* Hero */}
    <div style={{ padding:'0 20px 20px' }}>
      <div style={{
        background: T.ink, color: T.bg, borderRadius:4, padding:'22px 20px',
        display:'flex', alignItems:'center', gap:16,
      }}>
        <PlayerBadge player={me} size={64}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily: FD, fontSize:28, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1 }}>{me.name}</div>
          {me.nickname && <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:14, color:'rgba(247,244,237,0.6)', marginTop:6 }}>"{me.nickname}"</div>}
          <div style={{ fontFamily: FB, fontSize:12, color:'rgba(247,244,237,0.55)', marginTop:8, fontVariantNumeric:'tabular-nums' }}>
            {mePts?.seasonPts ?? 0} pts · {mePts?.wins ?? 0} {(mePts?.wins ?? 0) === 1 ? 'win' : 'wins'}
          </div>
        </div>
      </div>
    </div>

    <SectionLabel>Identity</SectionLabel>
    <div style={{ padding:'14px 20px 8px', display:'flex', flexDirection:'column', gap:14 }}>
      <Field label="Name" value={me.name || ''} onChange={v => update('name', v)} placeholder="Your name"/>
      <Field label="Nickname" value={me.nickname || ''} onChange={v => update('nickname', v)} placeholder="Juice, Boom, Chadillac…"/>
      <Field label="Tagline" value={me.tagline || ''} onChange={v => update('tagline', v)} placeholder="If in doubt, flat out." multiline/>
    </div>

    <SectionLabel style={{ marginTop:10 }}>Favorite Driver</SectionLabel>
    <div style={{ padding:'14px 20px 8px', fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute, lineHeight:1.5 }}>
      Pick one driver. Your player color and badge will match their primary livery.
    </div>
    <div style={{ padding:'4px 20px 24px' }}>
      <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:6 }}>
        {me.favDriverNum && <button onClick={() => update('favDriverNum', null)} style={{
          appearance:'none', border:`0.5px solid ${T.line2}`, background: T.card,
          padding:6, borderRadius:4, cursor:'pointer', flexShrink:0,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4,
          minWidth:64, minHeight:62,
          fontFamily: FL, fontSize:9, letterSpacing:'0.18em', textTransform:'uppercase', color: T.mute,
        }}>Clear</button>}
        {[...DEFAULT_DRIVERS].sort((a,b) => a.num - b.num).map(d => (
          <button key={d.num} onClick={() => update('favDriverNum', d.num)} style={{
            appearance:'none', border: me.favDriverNum === d.num ? `2px solid ${T.hot}` : `0.5px solid ${T.line2}`,
            background: T.card, padding:6, borderRadius:4, cursor:'pointer', flexShrink:0,
            display:'flex', flexDirection:'column', alignItems:'center', gap:4, minWidth:64,
          }}>
            <CarNum driver={d} size={32}/>
            <span style={{ fontFamily: FD, fontSize:11, fontWeight:600, letterSpacing:'-0.03em' }}>{d.name.slice(0,8)}</span>
          </button>
        ))}
      </div>
      <div style={{ marginTop:10, fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute }}>
        {me.favDriverNum
          ? `Currently: № ${me.favDriverNum} ${DEFAULT_DRIVERS.find(d => d.num === me.favDriverNum)?.name || ''}`
          : 'None picked'}
      </div>
    </div>

    <div style={{ padding:'0 20px 24px' }}>
      <button onClick={onBack} style={{
        appearance:'none', width:'100%', padding:16,
        background: T.ink, color: T.bg, border:'none', borderRadius:3, cursor:'pointer',
        fontFamily: FL, fontSize:11, fontWeight:500,
        letterSpacing:'0.24em', textTransform:'uppercase',
      }}>Save</button>
    </div>
  </div>;
}
