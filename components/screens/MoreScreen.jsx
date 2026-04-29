'use client';
import React, { useState } from 'react';
import { MenuRow, SectionLabel, TopBar } from '@/components/ui/primitives';
import { ROUNDS_PER_WEEK } from '@/lib/constants';

export default function MoreScreen({ state, me, setScreen, onReset, onSignOut }) {
  const { schedule, currentWeek, weeklyResults, adminId } = state;
  const lastResult = weeklyResults.sort((a,b) => b.wk - a.wk)[0];
  const isAdmin = me.id === adminId;
  const [resetArm, setResetArm] = useState(false);
  const armReset = () => {
    if (!resetArm) { setResetArm(true); setTimeout(() => setResetArm(false), 3000); return; }
    setResetArm(false); onReset();
  };
  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle="League · Settings" title="More"/>

    <SectionLabel>Profile</SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      <MenuRow label="My Profile" sub="Nickname, color, favorite driver" onClick={() => setScreen('profile')} last/>
    </div>

    <SectionLabel>League</SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      <MenuRow label="Schedule" sub={`${schedule.length} races · Wk ${currentWeek} of ${schedule.length}`} onClick={() => setScreen('schedule')}/>
      <MenuRow label="Draft History" sub={isAdmin ? `${weeklyResults.length} past week${weeklyResults.length === 1 ? '' : 's'} · tap to view or edit` : `${weeklyResults.length} past week${weeklyResults.length === 1 ? '' : 's'}`} onClick={() => setScreen('history')}/>
      <MenuRow label="Last Race Recap" sub={lastResult ? lastResult.track : 'No results yet'} onClick={() => setScreen('recap')} last/>
    </div>

    <SectionLabel>Settings</SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      <MenuRow label="League Members" sub="Edit names & colors" onClick={() => setScreen('members')}/>
      <MenuRow label="Manage Drivers" sub="Edit entry list" onClick={() => setScreen('drivers')}/>
      <MenuRow label="Rules" sub={`${ROUNDS_PER_WEEK} drivers/week · Snake`} onClick={() => setScreen('rules')}/>
      <MenuRow label="Switch to Another Player" sub="Return to league login" onClick={onSignOut} last/>
    </div>

    {isAdmin && <>
      <SectionLabel>Danger Zone</SectionLabel>
      <div style={{ padding:'14px 20px 40px' }}>
        <MenuRow label={resetArm ? 'Tap again to confirm' : 'Reset Season'} sub={resetArm ? 'This erases all picks & results' : 'Erase all results & drafts'} onClick={armReset} last/>
      </div>
    </>}
  </div>;
}
