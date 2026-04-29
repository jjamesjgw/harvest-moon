'use client';
import React from 'react';
import { BackChip, CarNum, Field, MenuRow, PlayerBadge, SectionLabel, TopBar, WinsCount } from '@/components/ui/primitives';
import { ADMIN_ID, FB, FD, FI, FL, T } from '@/lib/constants';
import { DEFAULT_DRIVERS } from '@/lib/data';
import { computePlayerDriverStats, computeStandings } from '@/lib/utils';

// Small dual-card showing a highlight driver — copper top stripe, car number,
// driver name, and a one-line stat below. Used at the top of the My Drivers
// section to surface the player's signature pick at a glance.
function StatCard({ label, driver, stat }) {
  return <div style={{
    border:`0.5px solid ${T.line2}`, borderRadius:4, background: T.card,
    padding:'12px 12px 10px', overflow:'hidden', position:'relative',
  }}>
    <div style={{
      position:'absolute', top:0, left:0, right:0, height:2, background: T.hot,
    }}/>
    <div style={{
      fontFamily: FL, fontSize:9, fontWeight:600,
      letterSpacing:'0.22em', textTransform:'uppercase', color: T.hot,
    }}>{label}</div>
    <div style={{ marginTop:8, fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em', lineHeight:1.1 }}>
      #{driver.driverNum} {driver.name}
    </div>
    <div style={{ marginTop:4, fontFamily: FB, fontSize:11, color: T.ink2, fontVariantNumeric:'tabular-nums' }}>
      {stat}
    </div>
  </div>;
}

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

  const { weeklyResults, currentWeek, draftHistory = [], weekDriversExtra = {} } = state;
  const mePts = isAdmin ? null : computeStandings(state.players, weeklyResults, currentWeek - 1).find(p => p.id === me.id);

  // Per-player driver stats. We merge default drivers with one-off entries so
  // historical picks like "Jesse Love at Daytona 500" still resolve to a name.
  const allDriversEver = [...DEFAULT_DRIVERS, ...Object.values(weekDriversExtra).flat()];
  const stats = isAdmin ? null : computePlayerDriverStats(me.id, draftHistory, weeklyResults, allDriversEver);
  const mostDrafted = stats?.byDriver.length
    ? [...stats.byDriver].sort((a, b) => b.picks - a.picks || b.totalPts - a.totalPts)[0]
    : null;
  const bestRoi = stats?.byDriver.length
    ? [...stats.byDriver].filter(d => d.picks >= 1).sort((a, b) => b.avgPts - a.avgPts)[0]
    : null;
  const driverList = stats?.byDriver.length
    ? [...stats.byDriver].sort((a, b) => b.picks - a.picks || b.totalPts - a.totalPts)
    : [];

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
              You can pick on behalf of any player, reset drafts, manage drivers, enter results, edit past weeks, and reset the season. Backups live in More → Admin Tools.
            </div>
          </div>
        </div>
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
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8, flexWrap:'wrap' }}>
            <span style={{ fontFamily: FB, fontSize:12, color:'rgba(247,244,237,0.55)', fontVariantNumeric:'tabular-nums' }}>
              {(mePts?.seasonPts ?? 0).toLocaleString()} pts
            </span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:3, color: (mePts?.wins ?? 0) > 0 ? T.hot : 'rgba(247,244,237,0.3)', fontFamily: FB, fontSize:11, fontWeight:600, fontVariantNumeric:'tabular-nums' }} title={`${mePts?.wins ?? 0} weekly ${(mePts?.wins ?? 0) === 1 ? 'win' : 'wins'}`}>
              <span>🏁</span><span>×{mePts?.wins ?? 0}</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    {/* My Drivers — only if the player has any draft history */}
    {stats && stats.totalPicks > 0 && <>
      <SectionLabel right={<span style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, textTransform:'none', letterSpacing:'0.01em', color: T.mute }}>{stats.totalPicks} pick{stats.totalPicks === 1 ? '' : 's'} · {stats.weeksPlayed} {stats.weeksPlayed === 1 ? 'week' : 'weeks'}</span>}>My Drivers</SectionLabel>

      {/* Two highlight cards: most-drafted + best ROI */}
      <div style={{ padding:'14px 20px 6px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {mostDrafted && <StatCard label="Most Drafted" driver={mostDrafted} stat={`${mostDrafted.picks}× · avg ${mostDrafted.avgPts}`}/>}
        {bestRoi && bestRoi.driverNum !== mostDrafted?.driverNum && <StatCard label="Best Avg" driver={bestRoi} stat={`avg ${bestRoi.avgPts} · ${bestRoi.picks}×`}/>}
        {bestRoi && bestRoi.driverNum === mostDrafted?.driverNum && <StatCard label="Top Score" driver={mostDrafted} stat={`best ${mostDrafted.bestFinish}`}/>}
      </div>

      {/* Full table */}
      <div style={{ padding:'14px 20px 24px' }}>
        <div style={{
          display:'grid',
          gridTemplateColumns:'auto 1fr 50px 50px 50px',
          padding:'8px 0',
          borderTop:`0.5px solid ${T.line}`, borderBottom:`0.5px solid ${T.line2}`,
          fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.2em', textTransform:'uppercase', color: T.mute,
        }}>
          <span style={{ paddingRight:8 }}>#</span>
          <span>Driver</span>
          <span style={{ textAlign:'right' }}>Picks</span>
          <span style={{ textAlign:'right' }}>Avg</span>
          <span style={{ textAlign:'right' }}>Best</span>
        </div>
        {driverList.map((row, i) => {
          const d = allDriversEver.find(dv => dv.num === row.driverNum);
          return <div key={row.driverNum} style={{
            display:'grid',
            gridTemplateColumns:'auto 1fr 50px 50px 50px',
            alignItems:'center',
            padding:'10px 0',
            borderBottom: i === driverList.length - 1 ? 'none' : `0.5px solid ${T.line2}`,
          }}>
            <div style={{ paddingRight:10 }}>
              {d ? <CarNum driver={d} size={26}/> : <span style={{ fontFamily: FD, fontSize:14, color: T.mute }}>#{row.driverNum}</span>}
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontFamily: FD, fontSize:14, fontWeight:600, letterSpacing:'-0.02em', lineHeight:1.1 }}>{row.name}</div>
              <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, color: T.mute, marginTop:2 }}>last Wk {String(row.lastWk).padStart(2,'0')}</div>
            </div>
            <div style={{ textAlign:'right', fontFamily: FB, fontSize:13, fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{row.picks}</div>
            <div style={{ textAlign:'right', fontFamily: FB, fontSize:13, fontWeight:500, fontVariantNumeric:'tabular-nums', color: T.ink2 }}>{row.avgPts}</div>
            <div style={{ textAlign:'right', fontFamily: FB, fontSize:13, fontWeight:500, fontVariantNumeric:'tabular-nums', color: T.ink2 }}>{row.bestFinish}</div>
          </div>;
        })}
      </div>
    </>}

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
