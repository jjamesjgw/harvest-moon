'use client';
import React, { useEffect, useState } from 'react';
import { BackChip, CarNum, Field, MenuRow, PlayerBadge, SectionLabel, TopBar, WinsCount } from '@/components/ui/primitives';
import { ADMIN_ID, FB, FD, FI, FL, T } from '@/lib/constants';
import { DEFAULT_DRIVERS } from '@/lib/data';
import { computeStandings } from '@/lib/utils';
import { disablePush, enablePush, getPushStatus } from '@/lib/push';

// iOS Safari requires the PWA to be installed to the home screen before
// the Web Push API is available. Detect that case so we can show install
// instructions instead of a dead toggle.
function isIOSNotStandalone() {
  if (typeof window === 'undefined') return false;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (!isIOS) return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  return !standalone;
}

function PushNotificationsBlock({ me }) {
  const [status, setStatus] = useState('available'); // 'unsupported' | 'denied' | 'subscribed' | 'available'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const iosNeedsInstall = isIOSNotStandalone();

  useEffect(() => {
    let cancelled = false;
    getPushStatus().then(s => { if (!cancelled) setStatus(s); });
    return () => { cancelled = true; };
  }, []);

  if (iosNeedsInstall) {
    return <div style={{ padding:'12px 20px 8px', fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute, lineHeight:1.5 }}>
      To get notifications on iPhone, tap Share and choose <strong>Add to Home Screen</strong>, then open the app from your home screen.
    </div>;
  }

  if (status === 'unsupported') {
    return <div style={{ padding:'12px 20px 8px', fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute, lineHeight:1.5 }}>
      Your browser doesn't support push notifications.
    </div>;
  }

  if (status === 'denied') {
    return <div style={{ padding:'12px 20px 8px', fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute, lineHeight:1.5 }}>
      Notifications are blocked. Enable them in your browser settings for this site.
    </div>;
  }

  const subscribed = status === 'subscribed';
  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = subscribed ? await disablePush() : await enablePush(me.id);
      if (!res.ok) setError(res.reason || 'failed');
      const next = await getPushStatus();
      setStatus(next);
    } catch (e) {
      setError(e?.message || 'failed');
    } finally {
      setBusy(false);
    }
  };

  return <div style={{ padding:'12px 20px 8px' }}>
    <button onClick={onClick} disabled={busy} style={{
      appearance:'none', width:'100%', padding:14,
      background: subscribed ? T.card : T.ink,
      color: subscribed ? T.ink : T.bg,
      border: subscribed ? `0.5px solid ${T.line2}` : 'none',
      borderRadius:3, cursor: busy ? 'wait' : 'pointer',
      fontFamily: FL, fontSize:11, fontWeight:500,
      letterSpacing:'0.24em', textTransform:'uppercase',
      opacity: busy ? 0.6 : 1,
    }}>
      {busy ? '…' : subscribed ? 'Turn off notifications' : 'Turn on notifications'}
    </button>
    <div style={{ marginTop:10, fontFamily: FI, fontStyle:'italic', fontSize:11, color: T.mute, lineHeight:1.5 }}>
      {subscribed
        ? 'You\'ll get a buzz when it\'s your turn to draft, when someone makes a pick, and when weekly results are posted.'
        : 'Get notified when it\'s your turn to draft, when someone picks, or when results are posted.'}
    </div>
    {error && <div style={{ marginTop:8, fontFamily: FI, fontSize:11, color: T.hot }}>
      Couldn't update notifications: {error}
    </div>}
  </div>;
}

// Tiny status pill rendered next to the Back chip on Profile. Mirrors the
// useLeague saveStatus state machine: 'idle' shows nothing, 'saving' shows
// a muted "Saving…" italic line, 'ok' briefly flashes "Saved ✓" in green,
// 'error' is already handled by the global SaveBanner so we stay quiet.
//
// We hold the 'ok' state visible for a beat after the status returns to
// 'idle' so the user actually sees the confirmation rather than a flash
// they might miss. Without this, fast typers would never see the ✓.
function SaveStatusPill({ status }) {
  const [visible, setVisible] = useState(null); // 'saving' | 'ok' | null
  useEffect(() => {
    if (status === 'saving') { setVisible('saving'); return; }
    if (status === 'ok' && visible === 'saving') {
      setVisible('ok');
      const t = setTimeout(() => setVisible(null), 1400);
      return () => clearTimeout(t);
    }
    if (status === 'idle' && visible !== 'ok') setVisible(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  if (!visible) return null;
  const isOk = visible === 'ok';
  return <span style={{
    display:'inline-flex', alignItems:'center', gap:5,
    padding:'4px 8px', borderRadius:3,
    background: isOk ? 'rgba(90,122,94,0.12)' : 'rgba(20,17,13,0.04)',
    color: isOk ? T.good : T.mute,
    fontFamily: FL, fontSize:9, fontWeight:600,
    letterSpacing:'0.22em', textTransform:'uppercase',
    transition:'background 200ms ease, color 200ms ease',
  }}>{isOk ? '✓ Saved' : 'Saving…'}</span>;
}

export default function ProfileScreen({ state, setState, me, onBack, onNav, saveStatus }) {
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
              You can pick on behalf of any player, reset drafts, manage drivers, enter results, edit past weeks, and reset the season. Backups live in More → Admin Tools.
            </div>
          </div>
        </div>
      </div>
    </div>;
  }

  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle="Your identity in the league" title="Profile" right={<div style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
      <SaveStatusPill status={saveStatus}/>
      <BackChip onClick={onBack}/>
    </div>}/>

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

    {/* My Drivers section moved to the new Drivers screen (More → Drivers).
        Profile now stays focused on personal identity: hero card, name fields,
        and favorite-driver selection. League-wide and personal driver stats
        live alongside each other on the Drivers screen so users can compare
        their picks against the field. */}

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
            <CarNum driver={d} size={32} onClick={() => onNav('drivers', { driverNum: d.num })}/>
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

    <SectionLabel style={{ marginTop:10 }}>Notifications</SectionLabel>
    <PushNotificationsBlock me={me}/>

    <div style={{ padding:'12px 20px 8px', fontFamily: FI, fontStyle:'italic', fontSize:11, color: T.mute, textAlign:'center', lineHeight:1.5 }}>
      Changes save automatically as you type.
    </div>
    <div style={{ padding:'0 20px 24px' }}>
      <button onClick={onBack} style={{
        appearance:'none', width:'100%', padding:16,
        background: T.ink, color: T.bg, border:'none', borderRadius:3, cursor:'pointer',
        fontFamily: FL, fontSize:11, fontWeight:500,
        letterSpacing:'0.24em', textTransform:'uppercase',
      }}>Done</button>
    </div>
  </div>;
}
