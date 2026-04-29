'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';

import { useLeague } from '@/lib/useLeague';
import { useGlobalStyles } from '@/lib/globalStyles';
import {
  T, FI, ADMIN_ID, ADMIN_PROFILE, CANONICAL_PLAYERS, ROUNDS_PER_WEEK,
} from '@/lib/constants';
import { DEFAULT_DRIVERS, DEFAULT_SCHEDULE } from '@/lib/data';
import {
  buildSnakeOrder, computeStandings, makeFreshState,
} from '@/lib/utils';
import {
  AppFrame, TabBar, SaveBanner, YourTurnToast,
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
import MembersScreen       from '@/components/screens/MembersScreen';
import SwitchScreen        from '@/components/screens/SwitchScreen';
import ManageDriversScreen from '@/components/screens/ManageDriversScreen';

// ─── HELPERS ─────────────────────────────────────────────────────

// Maps a sub-screen id to the bottom-tab it belongs under (for highlight state).
const SCREEN_TO_TAB = {
  home:'home',
  slot:'draft', draft:'draft', 'enter-results':'draft',
  standings:'standings',
  team:'team',
  more:'more', schedule:'more', history:'more', rules:'more',
  members:'more', switch:'more', recap:'more', drivers:'more',
  profile:'more', sync:'more',
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

// Computes whether `meId` is currently on the clock and which kind of pick is owed.
function detectMyTurn(state, meId) {
  if (!state || !meId) return null;
  const ds = state.draftState;
  if (!ds) return null;
  if (ds.phase === 'slot-pick') {
    const standings = computeStandings(state.players, state.weeklyResults, state.currentWeek - 1);
    const order = [...standings].sort((a, b) => a.seasonPts - b.seasonPts);
    const picker = order[ds.slotPickIdx];
    if (picker?.id === meId) return { kind: 'slot' };
  }
  if (ds.phase === 'snake') {
    const order = buildSnakeOrder(state.players, ds.slotAssign, ROUNDS_PER_WEEK);
    const onClock = order[ds.picks.length];
    if (onClock?.playerId === meId) return { kind: 'snake', round: onClock.round };
  }
  return null;
}

// ─── ROOT APP ────────────────────────────────────────────────────

export default function App() {
  useGlobalStyles();

  const { state: rawState, setState: setStateRemote, loading, saveStatus, lastError, retry } = useLeague();

  const [screen, setScreen] = useState('home');
  const [meId, setMeIdState] = useState(null);

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

  // "Your turn" detection + haptic buzz on transitions.
  const myTurnInfo = useMemo(() => detectMyTurn(state, meId), [state, meId]);
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
    } else if (id === 'switch') {
      setScreen('switch');
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
  const turnToast = myTurnInfo && screen !== 'slot' && screen !== 'draft'
    ? <YourTurnToast kind={myTurnInfo.kind} onGo={() => onNav('draft')}/>
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
    standings:       <StandingsScreen     state={state} onNav={onNav}/>,
    team:            <TeamScreen          state={state} me={me} onNav={onNav}/>,
    recap:           <RecapScreen         state={state} onNav={onNav}/>,
    more:            <MoreScreen          state={state} me={me} setScreen={setScreen} onReset={resetSeason} onSignOut={() => setMeIdState(null)}/>,
    profile:         <ProfileScreen       state={state} setState={setState} me={me} onBack={() => setScreen('home')}/>,
    schedule:        <ScheduleScreen      state={state} onBack={() => setScreen('more')}/>,
    history:         <HistoryScreen       state={state} onBack={() => setScreen('more')}/>,
    rules:           <RulesScreen         state={state} onBack={() => setScreen('more')}/>,
    members:         <MembersScreen       state={state} setState={setState} onBack={() => setScreen('more')}/>,
    switch:          <SwitchScreen        state={state} me={me} setMe={(p) => setMeIdState(p.id)} onBack={() => setScreen(screen === 'switch' ? 'home' : 'more')}/>,
    drivers:         <ManageDriversScreen state={state} setState={setState} onBack={() => onNav(driversReturnRef.current === 'draft' ? 'draft' : 'more')}/>,
  };

  return <AppFrame>
    {banner}
    {turnToast}
    <div ref={contentRef} className="hm-scroll" style={{ flex:1, overflowY:'auto', background: T.bg }}>
      {screens[screen]}
    </div>
    <TabBar active={activeTab} onNav={onNav}/>
  </AppFrame>;
}
