'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';

import { useLeague } from '@/lib/useLeague';
import { useGlobalStyles } from '@/lib/globalStyles';
import {
  T, FI, ADMIN_ID, ADMIN_PROFILE, CANONICAL_PLAYERS,
} from '@/lib/constants';
import { DEFAULT_DRIVERS, DEFAULT_SCHEDULE } from '@/lib/data';
import {
  buildSlotPickOrder, buildSnakeOrder, computeStandings, getWeekConfig, makeFreshState,
} from '@/lib/utils';
import {
  AppFrame, TabBar, OnTheClockBanner, PullToRefresh, SaveBanner, YourTurnToast,
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

// ─── HELPERS ─────────────────────────────────────────────────────

// Maps a sub-screen id to the bottom-tab it belongs under (for highlight state).
const SCREEN_TO_TAB = {
  home:'home',
  slot:'draft', draft:'draft', 'enter-results':'draft',
  standings:'standings',
  team:'team',
  more:'more', schedule:'more', history:'more', rules:'more',
  recap:'more', drivers:'more',
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

// Computes the active draft turn: which player is on the clock and what kind
// of pick is owed (slot or snake). Returns null when no draft is active.
function detectActiveTurn(state) {
  if (!state) return null;
  const ds = state.draftState;
  if (!ds) return null;
  if (ds.phase === 'slot-pick') {
    const order = buildSlotPickOrder(state.players, state.weeklyResults, state.currentWeek - 1);
    const picker = order[ds.slotPickIdx];
    if (picker) return { kind: 'slot', playerId: picker.id, name: picker.name };
  }
  if (ds.phase === 'snake') {
    const cfg = getWeekConfig(state, state.currentWeek);
    const order = buildSnakeOrder(state.players, ds.slotAssign, cfg.totalPicks);
    const onClock = order[ds.picks.length];
    if (onClock?.playerId) {
      const player = state.players.find(p => p.id === onClock.playerId);
      if (player) return { kind: 'snake', round: onClock.round, playerId: player.id, name: player.name };
    }
  }
  return null;
}

// ─── ROOT APP ────────────────────────────────────────────────────

export default function App() {
  useGlobalStyles();

  const { state: rawState, setState: setStateRemote, loading, saveStatus, lastError, retry, refresh, refreshing } = useLeague();

  const [screen, setScreen] = useState('home');
  const [meId, setMeIdState] = useState(null);
  const [editingWeek, setEditingWeek] = useState(null); // wk number when admin is editing a past week

  const contentRef = useRef(null);
  const driversReturnRef = useRef('more');
  const lastTurnRef = useRef(null);

  const state = useMemo(() => migrateState(rawState), [rawState]);
  const setState = (updater) =>
    setStateRemote(prev => (typeof updater === 'function' ? updater(prev) : updater));

  // Resolve the "me" subject. Admin lives outside of state.players.
  const me = state && meId
    ? (meId === ADMIN_ID ? ADMIN_PROFILE : state.players.find(p => p.id === meId))
    : null;

  // Auto-init a fresh league row if Supabase has no document yet.
  useEffect(() => {
    if (!loading && !rawState) setStateRemote(makeFreshState(CANONICAL_PLAYERS));
  }, [loading, rawState, setStateRemote]);

  // Scroll back to top whenever we change screens.
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [screen]);

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

  // Navigation. Special-cases: 'draft' decides slot vs snake screen by phase;
  // 'drivers' tracks the originating screen so Back routes correctly.
  const onNav = (id) => {
    if (id === 'draft') {
      const phase = state?.draftState?.phase;
      setScreen(phase === 'slot-pick' || phase === 'ready' ? 'slot' : 'draft');
    } else if (id === 'drivers') {
      driversReturnRef.current = (screen === 'draft' || screen === 'slot') ? 'draft' : 'more';
      setScreen('drivers');
    } else {
      setScreen(id);
    }
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
    setScreen('home');
  };

  const banner = <SaveBanner status={saveStatus} error={lastError} onRetry={retry}/>;

  // The personal toast (your turn) supersedes the global on-the-clock banner so
  // the screen never stacks both. Hide both on the screens that already show
  // turn information natively (slot, draft).
  const onDraftScreen = screen === 'slot' || screen === 'draft';
  const turnToast = myTurnInfo && !onDraftScreen
    ? <YourTurnToast kind={myTurnInfo.kind} onGo={() => onNav('draft')}/>
    : null;
  const draftBanner = activeTurn && !isMyTurn && !onDraftScreen
    ? <OnTheClockBanner pickerName={activeTurn.name} onTap={() => onNav('draft')}/>
    : null;

  // ─── Loading + login gates ──────────────────────────

  if (loading) {
    return <div style={{
      minHeight:'100vh', background: T.bg,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily: FI, fontStyle:'italic', fontSize:16, color: T.mute,
    }}>{banner}Loading league…</div>;
  }

  if (!me) {
    return <AppFrame>
      {banner}
      <LoginScreen
        onLogin={(p) => { setMeIdState(p.id); setScreen('home'); }}
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
    'edit-results':  <EnterResultsScreen  state={state} setState={setState} me={me} onNav={(id) => { setEditingWeek(null); onNav(id); }} editWeek={editingWeek}/>,
    standings:       <StandingsScreen     state={state} onNav={onNav}/>,
    team:            <TeamScreen          state={state} me={me} onNav={onNav}/>,
    recap:           <RecapScreen         state={state} onNav={onNav}/>,
    more:            <MoreScreen          state={state} me={me} setScreen={setScreen} onReset={resetSeason} onSignOut={() => setMeIdState(null)}/>,
    profile:         <ProfileScreen       state={state} setState={setState} me={me} onBack={() => setScreen('home')}/>,
    schedule:        <ScheduleScreen      state={state} onBack={() => setScreen('more')}/>,
    history:         <HistoryScreen       state={state} me={me} onBack={() => setScreen('more')} onEdit={(wk) => { setEditingWeek(wk); setScreen('edit-results'); }}/>,
    rules:           <RulesScreen         state={state} onBack={() => setScreen('more')}/>,
    drivers:         <ManageDriversScreen state={state} setState={setState} me={me} onBack={() => onNav(driversReturnRef.current === 'draft' ? 'draft' : 'more')}/>,
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
  </AppFrame>;
}
