'use client';
import React, { useState } from 'react';
import { BackChip, CarNum, PlayerBadge, SectionLabel, TopBar } from '@/components/ui/primitives';
import { FB, FD, FI, FL, SERIES, T } from '@/lib/constants';
import { DEFAULT_DRIVERS } from '@/lib/data';
import { shareOrDownloadCard } from '@/lib/shareCard';

// Resolve a pick → driver definition with series awareness. Cup picks come
// from the default pool + this week's one-off Cup adds. Bonus picks come from
// the per-week bonus pool. Falls back to a stub from pick.driverName if the
// pool entry was later removed.
function resolveDriver(state, wk, pk) {
  const series = pk.series || 'Cup';
  if (series === 'Cup') {
    const wkExtras = (state.weekDriversExtra || {})[wk] || [];
    const cup = [...DEFAULT_DRIVERS, ...wkExtras];
    return cup.find(d => d.num === pk.driverNum) || stub(pk);
  }
  const pool = state.bonusDriversByWeek?.[wk]?.[series] || [];
  return pool.find(d => d.num === pk.driverNum) || stub(pk);
}
function stub(pk) {
  return {
    num: pk.driverNum, name: pk.driverName || `#${pk.driverNum}`,
    primary: '#7A7268', secondary: '#3D3934', team: '—',
  };
}

function SeriesTag({ series }) {
  if (!series || series === 'Cup') return null;
  const meta = SERIES[series] || { short: series.slice(0,3).toUpperCase() };
  return <span style={{
    display:'inline-block', padding:'1px 4px', borderRadius:2,
    background: T.hot, color:'#fff',
    fontFamily: FL, fontSize:7, fontWeight:700,
    letterSpacing:'0.16em', textTransform:'uppercase',
    verticalAlign:'middle', marginLeft:3,
  }}>{meta.short}</span>;
}

export default function RecapScreen({ state, onNav }) {
  const { players, weeklyResults, draftHistory = [] } = state;
  if (weeklyResults.length === 0) {
    return <div style={{ paddingBottom:20 }}>
      <TopBar title="Race Recap" right={<BackChip onClick={() => onNav('more')}/>}/>
      <div style={{ padding:'40px 28px', textAlign:'center' }}>
        <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:16, color: T.mute, lineHeight:1.5 }}>
          No completed races yet. Once you finish the first week, the recap will appear here.
        </div>
      </div>
    </div>;
  }
  const last = weeklyResults.sort((a,b) => b.wk - a.wk)[0];
  const sortedRes = players.map(p => ({ ...p, pts: last.pts[p.id] || 0 })).sort((a,b) => b.pts - a.pts);
  const hist = draftHistory.find(h => h.wk === last.wk);
  const raceMeta = (state.schedule || []).find(s => s.wk === last.wk);

  // Generates the share-card payload and routes through the system share
  // sheet (Messages, AirDrop, Photos, etc.) on supporting devices, falling
  // back to a download otherwise. The button label adapts to its capability:
  // "Share" when native is available, "Download" otherwise — so users see
  // the right verb for what will actually happen.
  const [shareState, setShareState] = useState('idle'); // 'idle' | 'busy' | 'shared' | 'downloaded' | 'error'
  // canShare is computed once on mount; recomputing it every render is cheap
  // but the API only matters at click-time so we don't track it as state.
  const supportsNativeShare = (() => {
    if (typeof navigator === 'undefined') return false;
    if (typeof navigator.canShare !== 'function') return false;
    try {
      const probe = new File(['x'], 'x.png', { type: 'image/png' });
      return navigator.canShare({ files: [probe] });
    } catch { return false; }
  })();

  const onShare = async () => {
    if (shareState === 'busy') return;
    setShareState('busy');
    const payload = {
      meta: { wk: last.wk, raceName: raceMeta?.raceName, track: last.track },
      players: sortedRes.map(p => {
        const myPicks = hist ? hist.picks.filter(pk => pk.playerId === p.id) : [];
        return {
          name: p.name,
          color: p.color,
          pts: p.pts,
          drivers: myPicks.map(pk => {
            const d = resolveDriver(state, last.wk, pk);
            return {
              num: d.num, name: d.name,
              primary: d.primary, secondary: d.secondary,
              series: pk.series || 'Cup',
            };
          }),
        };
      }),
    };
    const result = await shareOrDownloadCard(payload);
    setShareState(result === 'cancelled' ? 'idle' : result);
    if (result !== 'cancelled') {
      try { navigator.vibrate?.(20); } catch {}
      setTimeout(() => setShareState('idle'), 2000);
    }
  };

  const buttonLabel = (() => {
    if (shareState === 'busy') return 'Preparing…';
    if (shareState === 'shared') return '✓ Shared';
    if (shareState === 'downloaded') return '✓ Saved';
    if (shareState === 'error') return 'Try again';
    return supportsNativeShare ? '↗ Share Race Card' : '↓ Download Race Card';
  })();

  return <div style={{ paddingBottom:20 }}>
    <TopBar
      subtitle={`Wk ${String(last.wk).padStart(2,'0')} · Final`}
      title="Race Recap"
      right={<BackChip onClick={() => onNav('more')}/>}
    />

    <div style={{ padding:'0 20px 20px' }}>
      <div style={{ background: T.ink, color: T.bg, borderRadius:4, padding:'22px 20px' }}>
        <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.24em', textTransform:'uppercase', color:'rgba(247,244,237,0.4)' }}>Race</div>
        <div style={{ fontFamily: FD, fontSize:34, fontWeight:600, lineHeight:1, letterSpacing:'-0.03em', marginTop:4 }}>
          {raceMeta?.raceName || last.track}
        </div>
        {raceMeta?.raceName && <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:13, color:'rgba(247,244,237,0.6)', marginTop:6 }}>
          {last.track}
        </div>}
        <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:14, color:'rgba(247,244,237,0.7)', marginTop:10 }}>
          <span style={{ color: T.bg }}>{sortedRes[0].name}</span> took the week · {sortedRes[0].pts} pts
        </div>
      </div>

      <button onClick={onShare} disabled={shareState === 'busy'} style={{
        appearance:'none', width:'100%', marginTop:12,
        background: shareState === 'shared' || shareState === 'downloaded' ? T.good : T.hot,
        color: shareState === 'shared' || shareState === 'downloaded' ? '#fff' : T.ink,
        border:'none', borderRadius:3,
        padding:'12px 14px', cursor: shareState === 'busy' ? 'default' : 'pointer',
        fontFamily: FL, fontSize:11, fontWeight:600,
        letterSpacing:'0.24em', textTransform:'uppercase',
        transition:'background 200ms ease, color 200ms ease',
      }}>{buttonLabel}</button>
      <div style={{ marginTop:6, fontFamily: FI, fontStyle:'italic', fontSize:11, color: T.mute, lineHeight:1.5 }}>
        {supportsNativeShare
          ? 'Opens the share sheet — Messages, AirDrop, Photos, group chats.'
          : 'Saves a 1080×1920 image perfect for the league group text.'}
      </div>
    </div>

    <SectionLabel>Week Results</SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      {sortedRes.map((p, i) => (
        <div key={p.id} style={{
          display:'flex', alignItems:'center', gap:14,
          padding:'12px 0',
          borderBottom: i === sortedRes.length-1 ? 'none' : `0.5px solid ${T.line2}`,
        }}>
          <div style={{ fontFamily: FD, fontSize:18, fontWeight:600, width:22, color: i === 0 ? T.hot : T.ink, fontVariantNumeric:'tabular-nums' }}>{String(i+1).padStart(2,'0')}</div>
          <PlayerBadge player={p} size={24}/>
          <div style={{ flex:1, fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em' }}>{p.name}</div>
          <div style={{ fontFamily: FB, fontSize:15, fontWeight: i === 0 ? 600 : 500, fontVariantNumeric:'tabular-nums', color: i === 0 ? T.hot : T.ink }}>{p.pts}</div>
        </div>
      ))}
    </div>

    {hist && <>
      <SectionLabel>Rosters · How it Broke Down</SectionLabel>
      <div style={{ padding:'14px 20px 20px' }}>
        {[...players]
          .sort((a, b) => (last.pts[b.id] || 0) - (last.pts[a.id] || 0))
          .map((p, i, arr) => {
            const roster = hist.picks.filter(pk => pk.playerId === p.id);
            return <div key={p.id} style={{
              padding:'14px 0',
              borderBottom: i === arr.length-1 ? 'none' : `0.5px solid ${T.line2}`,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <PlayerBadge player={p} size={20}/>
                <span style={{ fontFamily: FD, fontSize:16, fontWeight:600, letterSpacing:'-0.03em' }}>{p.name}</span>
                <span style={{ marginLeft:'auto', fontFamily: FB, fontSize:14, fontWeight:500, fontVariantNumeric:'tabular-nums' }}>{last.pts[p.id] || 0} pts</span>
              </div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
                {roster.map((pk, pi) => {
                  const d = resolveDriver(state, last.wk, pk);
                  const series = pk.series || 'Cup';
                  // Only Cup chips are tappable — they have season-wide stats.
                  // Bonus picks come from one-week pools, so opening "driver
                  // detail" for them would either mismatch or be empty.
                  return <span key={`${series}:${pk.driverNum}:${pi}`} style={{ display:'inline-flex', alignItems:'center' }}>
                    <CarNum driver={d} size={26}
                      onClick={series === 'Cup' ? () => onNav('drivers', { driverNum: d.num }) : undefined}/>
                    <SeriesTag series={series}/>
                  </span>;
                })}
              </div>
            </div>;
          })}
      </div>
    </>}
  </div>;
}
