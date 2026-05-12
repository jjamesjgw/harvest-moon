'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';

import { useLeague } from '@/lib/useLeague';
import { useGlobalStyles } from '@/lib/globalStyles';
import {
  T, FI, ADMIN_ID, ADMIN_PROFILE, CANONICAL_PLAYERS,
} from '@/lib/constants';
import { DEFAULT_DRIVERS, DEFAULT_SCHEDULE } from '@/lib/data';
import {
  buildSlotPickOrder, buildSnakeOrder, computeStandings, detectActiveTurn, getWeekConfig, makeFreshState, draftProgressLabel,
} from '@/lib/utils';
import {
  AppFrame, TabBar, OnTheClockBanner, PullToRefresh, SaveBanner, YourTurnToast,
  JustPickedToast,
} from '@/components/ui/primitives';

import HomeScreen          from '@/components/screens/HomeScreen';
import LoginScreen         from '@/components/screens/LoginScreen';
import SlotPickScreen      from '@/components/screens/SlotPickScreen';
import DraftScreen         from '@/components/screens/DraftScreen';
import EnterResultsScreen  from '@/components/screens/EnterResultsScreen';
import StandingsScreen     from '@/components/screens/StandingsScreen';
import TeamScreen          from '@/components/screens/TeamScreen';
import RecapScreen         from '@/components/screens/RecapScreen';
import MoreScreen          from '@/components/screens/MoreScreen';
import ProfileScreen       from '@/components/screens/ProfileScreen';
import ScheduleScreen      from '@/components/screens/ScheduleScreen';
import HistoryScreen       from '@/components/screens/HistoryScreen';
import RulesScreen         from '@/components/screens/RulesScreen';
import ManageDriversScreen from '@/components/screens/ManageDriversScreen';
import DriversScreen from '@/components/screens/DriversScreen';

// ─── HELPERS ─────────────────────────────────────────────────────

// Maps a sub-screen id to the bottom-tab it belongs under (for highlight state).
const SCREEN_TO_TAB = {
  home:'home',
  slot:'draft', draft:'draft', 'enter-results':'draft',
  standings:'standings',
  team:'team',
  more:'more', schedule:'more', history:'more', rules:'more',
  recap:'more', drivers:'more', 'manage-drivers':'more',
  profile:'more', sync:'more', 'edit-results':'more',
};

// Apply migrations to remote state before consumption.
// - Always force the canonical 6 players + canonical schedule
// - Build the merged drivers list (defaults + this week's one-offs)
// - Override player.color from their favorite driver's primary livery
// - Set adminId to the dedicated ADMIN account
function migrateState(rawState) {
  if (!rawState) return null;
  const patched = { ...rawState };
  patched.schedule = DEFAULT_SCHEDULE;
  patched.weekDriversExtra = patched.weekDriversExtra || {};
  // Ensure bonus structures exist so screens can read them without optional chaining.
  patched.bonusDriversByWeek = patched.bonusDriversByWeek || {};
  patched.weekConfig = patched.weekConfig || {};
  const wkExtras = patched.weekDriversExtra[patched.currentWeek] || [];
  patched.drivers = [...DEFAULT_DRIVERS, ...wkExtras];

  const existing = patched.players || [];
  patched.players = CANONICAL_PLAYERS.map(cp => {
    const m = existing.find(e => e.name?.toLowerCase().trim() === cp.name.toLowerCase());
    const merged = m
      ? { ...m, id: cp.id, name: cp.name, color: m.color || cp.color, initial: cp.initial }
      : cp;
    if (merged.favDriverNum) {
      const fav = patched.drivers.find(d => d.num === merged.favDriverNum)
              || DEFAULT_DRIVERS.find(d => d.num === merged.favDriverNum);
      if (fav?.primary) merged.color = fav.primary;
    }
    return merged;
  });
  patched.adminId = ADMIN_ID;
  return patched;
}

// ─── ROOT APP ────────────────────────────────────────────────────

export default function App() {
  useGlobalStyles();

  const { state: rawState, setState: setStateRemote, loading, saveStatus, lastError, retry, refresh, refreshing, fetchSucceeded } = useLeague();

  const [screen, setScreen] = useState('home');
  // Persistent login: rehydrate the last-signed-in player ID from localStorage
  // so cold starts (especially after iOS Safari reaps the PWA) don't require
  // re-entering name + PIN every time. The id is just a routing handle —
  // PIN verification still happens at LoginScreen for the initial sign-in,
  // and we re-validate that the id resolves to a real player after rehydration.
  const [meId, setMeIdState] = useState(() => {
    if (typeof window === 'undefined') return null;
    try { return window.localStorage.getItem('harvest-moon:me-id') || null; }
    catch { return null; }
  });
  const setMeId = (next) => {
    setMeIdState(next);
    if (typeof window === 'undefined') return;
    try {
      if (next) window.localStorage.setItem('harvest-moon:me-id', next);
      else window.localStorage.removeItem('harvest-moon:me-id');
    } catch {}
  };
  const [editingWeek, setEditingWeek] = useState(null); // wk number when admin is editing a past week
  // When a CarNum chip is tapped anywhere in the app, we route to 'drivers'
  // and stash the target driver number here so DriversScreen can open the
  // detail view directly. The screen clears it on first read so subsequent
  // navigations don't reopen the same driver.
  const [pendingDriverNum, setPendingDriverNum] = useState(null);
  // Same pattern for "view another player's team". Set when a PlayerBadge
  // is tapped anywhere in the app; cleared on Back, on explicit Team-tab
  // taps, and overwritten when a new playerId arrives. TeamScreen reads
  // this directly — clearing it here flips the view back to "my team."
  const [pendingViewingPlayerId, setPendingViewingPlayerId] = useState(null);
  // Deep-link target for RecapScreen when navigated via Home's Last Race
  // strip or similar entry points. Defaults to "latest finalized week"
  // when null. Same consume-on-mount pattern as the driver / player stashes.
  const [pendingRecapWk, setPendingRecapWk] = useState(null);

  const contentRef = useRef(null);
  const lastTurnRef = useRef(null);

  const state = useMemo(() => migrateState(rawState), [rawState]);
  const setState = (updater) =>
    setStateRemote(prev => (typeof updater === 'function' ? updater(prev) : updater));

  // Resolve the "me" subject. Admin lives outside of state.players.
  const me = state && meId
    ? (meId === ADMIN_ID ? ADMIN_PROFILE : state.players.find(p => p.id === meId))
    : null;

  // Auto-init a fresh league row if Supabase has no document yet.
  // CRITICAL: gated on fetchSucceeded so a transient Supabase fetch failure
  // (which leaves rawState=null but loading=false via either the catch
  // branch or the 3s boot timeout) cannot be mistaken for "no row exists"
  // and trigger a wipe-write over real league data.
  useEffect(() => {
    if (!loading && !rawState && fetchSucceeded) {
      setStateRemote(makeFreshState(CANONICAL_PLAYERS));
    }
  }, [loading, rawState, fetchSucceeded, setStateRemote]);

  // Scroll back to top whenever we change screens.
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [screen]);

  // When the draft phase advances to 'snake' (e.g. after the slot-pick
  // countdown completes), any screen still showing the slot picker jumps
  // forward to the actual draft board. This closes a race between
  // SlotPickScreen's countdown setState(phase:'snake') and its imperative
  // onNav('draft') call — onNav resolves the target via closure, so it
  // can read the stale 'ready' phase and route back to 'slot'. This effect
  // runs after the state update commits, so phase is guaranteed fresh.
  // Also catches peers who see the snake-phase update land via Supabase
  // realtime while still on the slot screen.
  useEffect(() => {
    if (state?.draftState?.phase === 'snake' && screen === 'slot') {
      // Don't push 'slot' onto history here: the snake draft is now active,
      // so a Back from the draft screen shouldn't drop the user onto a slot
      // picker that would just immediately bounce them forward again.
      setScreen('draft');
    }
  }, [state?.draftState?.phase, screen]);

  // Turn detection — now player-agnostic. We derive both "active picker info"
  // and "is it me?" from one source.
  const activeTurn = useMemo(() => detectActiveTurn(state), [state]);
  const isMyTurn = activeTurn && me && activeTurn.playerId === me.id;
  const myTurnInfo = isMyTurn ? activeTurn : null;

  // Haptic buzz when MY turn arrives.
  useEffect(() => {
    const sig = myTurnInfo ? `${myTurnInfo.kind}-${myTurnInfo.round || 0}` : null;
    if (sig && sig !== lastTurnRef.current) {
      try { navigator.vibrate?.([100, 50, 100]); } catch {}
    }
    lastTurnRef.current = sig;
  }, [myTurnInfo]);

  // Just-picked toast for off-draft screens. When a new pick lands during an
  // active draft and the user is NOT looking at the draft (they're on Home,
  // Standings, etc.), surface a small bottom toast saying who picked what.
  // The on-the-clock banner already says who's NEXT — this completes the
  // story by showing what just happened. Auto-dismisses after 3s.
  //
  // We track picks length via a ref so we only fire when picks actually grow,
  // not on every realtime echo. Picks shrinking (undo) silently resets the
  // ref so the next legitimate add re-arms.
  const prevPicksLenRef = useRef(0);
  const [justPicked, setJustPicked] = useState(null); // { pick, player, driver } | null
  useEffect(() => {
    const picks = state?.draftState?.picks || [];
    const prevLen = prevPicksLenRef.current;
    prevPicksLenRef.current = picks.length;
    if (picks.length <= prevLen) return; // shrinkage or no change
    if (!state) return;
    const newest = picks[picks.length - 1];
    if (!newest) return;
    // Don't spam ourselves with toasts about our own picks — we made them,
    // we already saw them confirm.
    if (me && newest.playerId === me.id) return;
    const player = state.players.find(p => p.id === newest.playerId);
    if (!player) return;
    const driver = (() => {
      const series = newest.series || 'Cup';
      if (series === 'Cup') {
        const wkExtras = (state.weekDriversExtra || {})[state.currentWeek] || [];
        const cup = [...DEFAULT_DRIVERS, ...wkExtras];
        return cup.find(d => d.num === newest.driverNum) || { num: newest.driverNum, name: newest.driverName || `#${newest.driverNum}` };
      }
      const pool = state.bonusDriversByWeek?.[state.currentWeek]?.[series] || [];
      return pool.find(d => d.num === newest.driverNum) || { num: newest.driverNum, name: newest.driverName || `#${newest.driverNum}` };
    })();
    setJustPicked({ pick: newest, player, driver });
  }, [state?.draftState?.picks?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation history stack. Every meaningful screen change pushes the
  // PREVIOUS screen onto historyRef so Back behaves like a real browser/iOS
  // back: returns to where the user actually was, not to a hardcoded parent.
  // Tab switches also push, so backing out of a sub-screen via the tab bar
  // still leaves the prior tab on the stack.
  //
  // Special id 'back' triggers goBack() — used by every BackChip in the app
  // so screens don't have to know their own parent. Identical-target navs
  // (re-tap of the current screen) are no-ops and don't double-stack.
  const historyRef = useRef([]);
  const goBack = () => {
    setPendingDriverNum(null); // never carry deep-link state across back
    setPendingViewingPlayerId(null);
    setPendingRecapWk(null);
    const prev = historyRef.current.pop();
    setScreen(prev || 'home');
  };
  // Resolve a logical id (potentially with phase-aware routing) to the
  // concrete screen we want to land on. Pulled out so onNav and any
  // bypass paths can use the same translation.
  const resolveTarget = (id) => {
    if (id === 'draft') {
      const phase = state?.draftState?.phase;
      return (phase === 'slot-pick' || phase === 'ready') ? 'slot' : 'draft';
    }
    return id;
  };
  // Special-cases: 'back' pops history; 'draft' decides slot vs snake by
  // phase; payload.driverNum routes to the analytical Drivers screen with a
  // specific driver pre-opened. The driversReturnRef + driver-detail special
  // cases are GONE — history handles all of it now.
  const onNav = (id, payload) => {
    if (id === 'back') { goBack(); return; }
    if (payload?.driverNum != null) {
      setPendingDriverNum(payload.driverNum);
    }
    if (payload?.playerId != null) {
      setPendingViewingPlayerId(payload.playerId);
    }
    if (payload?.wk != null) {
      setPendingRecapWk(payload.wk);
    }
    // Explicit Team-tab tap (no payload) always returns to "your team."
    // Without this, a stale viewing stash could outlast the user's intent.
    if (id === 'team' && payload?.playerId == null) {
      setPendingViewingPlayerId(null);
    }
    const target = resolveTarget(id);
    if (target === screen) return; // re-tap same screen — no-op, don't double-stack
    historyRef.current.push(screen);
    if (historyRef.current.length > 30) historyRef.current.shift(); // bound memory
    setScreen(target);
  };

  const activeTab = SCREEN_TO_TAB[screen] || 'home';

  const resetSeason = () => {
    setState(s => ({
      ...s,
      currentWeek: 1,
      weeklyResults: [],
      draftHistory: [],
      draftState: { phase:'slot-pick', slotPickIdx:0, slotAssign:{}, currentRound:1, picks:[] },
    }));
    historyRef.current = [];
    setScreen('home');
  };

  const banner = <SaveBanner status={saveStatus} error={lastError} onRetry={retry}/>;

  // The personal toast (your turn) supersedes the global on-the-clock banner so
  // the screen never stacks both. Hide both on the screens that already show
  // turn information natively (slot, draft).
  const onDraftScreen = screen === 'slot' || screen === 'draft';
  const turnToast = myTurnInfo && !onDraftScreen
    ? <YourTurnToast
        kind={myTurnInfo.kind}
        progress={draftProgressLabel(state)}
        onGo={() => onNav('draft')}/>
    : null;
  const draftBanner = activeTurn && !isMyTurn && !onDraftScreen
    ? <OnTheClockBanner
        pickerName={activeTurn.name}
        progress={draftProgressLabel(state)}
        onTap={() => onNav('draft')}/>
    : null;

  // ─── Loading + login gates ──────────────────────────

  if (loading) {
    // Skeleton mirrors the Home screen layout (top bar, dark hero card,
    // three leaderboard rows) so when the real content arrives the layout
    // doesn't shift. The shimmer is a slow opacity pulse — easier on the
    // eyes than a sliding gradient and works on the cream bg without
    // looking like marketing-page polish.
    const shimmer = { animation: 'hm-shimmer 1.4s ease-in-out infinite' };
    const skBlock = (w, h, radius = 4, extra = {}) => ({
      width: w, height: h, borderRadius: radius,
      background: 'rgba(20,17,13,0.10)',
      ...shimmer, ...extra,
    });
    return <AppFrame>
      {banner}
      <div style={{ flex:1, overflowY:'auto', background: T.bg }}>
        {/* Top bar shape */}
        <div style={{
          paddingTop:'max(18px, calc(env(safe-area-inset-top) + 8px))',
          paddingLeft:20, paddingRight:20, paddingBottom:20,
          display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:12,
        }}>
          <div style={{ flex:1 }}>
            <div style={skBlock(120, 11, 2)}/>
            <div style={{ ...skBlock(180, 28, 4), marginTop:8, background:'rgba(20,17,13,0.16)' }}/>
          </div>
          <div style={skBlock(36, 36, 18)}/>
        </div>
        {/* Hero card shape — dark, like Home's race hero */}
        <div style={{ padding:'0 20px 16px' }}>
          <div style={{
            background: T.ink, borderRadius:4, padding:'22px 20px',
          }}>
            <div style={{ ...skBlock(80, 9, 2), background:'rgba(247,244,237,0.14)' }}/>
            <div style={{ ...skBlock(220, 36, 4), marginTop:10, background:'rgba(247,244,237,0.18)' }}/>
            <div style={{ ...skBlock(140, 12, 2), marginTop:12, background:'rgba(247,244,237,0.10)' }}/>
            <div style={{ ...skBlock(180, 12, 2), marginTop:6, background:'rgba(247,244,237,0.08)' }}/>
          </div>
        </div>
        {/* Three leaderboard rows */}
        <div style={{ padding:'0 20px 8px' }}>
          <div style={skBlock(100, 9, 2)}/>
        </div>
        <div style={{ padding:'14px 20px 20px' }}>
          {[0,1,2].map(i => <div key={i} style={{
            padding:'14px 0',
            borderBottom: i === 2 ? 'none' : `0.5px solid ${T.line2}`,
            display:'flex', alignItems:'center', gap:14,
          }}>
            <div style={skBlock(20, 16, 2)}/>
            <div style={skBlock(26, 26, 13)}/>
            <div style={{ flex:1 }}>
              <div style={skBlock(110, 18, 3)}/>
            </div>
            <div style={skBlock(56, 14, 2)}/>
          </div>)}
        </div>
        <div style={{
          padding:'18px 20px', textAlign:'center',
          fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.mute,
          ...shimmer,
        }}>Loading league…</div>
      </div>
    </AppFrame>;
  }

  if (!me) {
    return <AppFrame>
      {banner}
      <LoginScreen
        onLogin={(p) => { setMeId(p.id); setScreen('home'); }}
        players={state?.players || CANONICAL_PLAYERS}
      />
    </AppFrame>;
  }

  // ─── Main shell ────────────────────────────────────

  const screens = {
    home:            <HomeScreen          state={state} me={me} onNav={onNav}/>,
    slot:            <SlotPickScreen      state={state} setState={setState} me={me} onNav={onNav}/>,
    draft:           <DraftScreen         state={state} setState={setState} me={me} onNav={onNav}/>,
    'enter-results': <EnterResultsScreen  state={state} setState={setState} me={me} onNav={onNav}/>,
    'edit-results':  <EnterResultsScreen  state={state} setState={setState} me={me} onNav={(id, p) => { if (id === 'back') setEditingWeek(null); onNav(id, p); }} editWeek={editingWeek}/>,
    standings:       <StandingsScreen     state={state} me={me} onNav={onNav}/>,
    team:            <TeamScreen          state={state} me={me} viewingPlayerId={pendingViewingPlayerId} onNav={onNav}/>,
    recap:           <RecapScreen         state={state} onNav={onNav} viewWk={pendingRecapWk} onConsumeViewWk={() => setPendingRecapWk(null)}/>,
    more:            <MoreScreen          state={state} me={me} onNav={onNav} onReset={resetSeason} onSignOut={() => setMeId(null)}/>,
    profile:         <ProfileScreen       state={state} setState={setState} me={me} saveStatus={saveStatus} onBack={() => onNav('back')}/>,
    schedule:        <ScheduleScreen      state={state} onNav={onNav} onBack={() => onNav('back')}/>,
    history:         <HistoryScreen       state={state} me={me} onBack={() => onNav('back')} onNav={onNav} onEdit={(wk) => { setEditingWeek(wk); onNav('edit-results'); }}/>,
    rules:           <RulesScreen         state={state} onBack={() => onNav('back')}/>,
    drivers:         <DriversScreen       state={state} me={me} initialNum={pendingDriverNum} onConsumeInitial={() => setPendingDriverNum(null)} onBack={() => onNav('back')}/>,
    'manage-drivers':<ManageDriversScreen state={state} setState={setState} me={me} onBack={() => onNav('back')}/>,
  };

  return <AppFrame>
    {banner}
    {turnToast}
    {draftBanner}
    <PullToRefresh
      ref={contentRef}
      onRefresh={refresh}
      busy={refreshing}
      disabled={onDraftScreen}
      style={{ flex:1, overflowY:'auto', background: T.bg }}
    >
      {screens[screen]}
    </PullToRefresh>
    <TabBar active={activeTab} onNav={onNav}/>
    {justPicked && !onDraftScreen && <JustPickedToast
      player={justPicked.player}
      driver={justPicked.driver}
      onTap={() => { setJustPicked(null); onNav('draft'); }}
      onDismiss={() => setJustPicked(null)}
    />}
  </AppFrame>;
}
