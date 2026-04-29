'use client';
import React, { useState } from 'react';
import { MenuRow, SectionLabel, TopBar } from '@/components/ui/primitives';
import { ROUNDS_PER_WEEK } from '@/lib/constants';

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
      <MenuRow label="Drivers" sub="League-wide stats & per-driver breakdowns" onClick={() => setScreen('drivers')}/>
      <MenuRow label="Last Race Recap" sub={lastResult ? lastResult.track : 'No results yet'} onClick={() => setScreen('recap')} last/>
    </div>

    <SectionLabel>Settings</SectionLabel>
    <div style={{ padding:'14px 20px 20px' }}>
      <MenuRow label="Rules" sub={`${ROUNDS_PER_WEEK} drivers/week · Snake`} onClick={() => setScreen('rules')}/>
      <MenuRow label="Sign Out" sub="Return to league login" onClick={onSignOut} last/>
    </div>

    {isAdmin && <>
      <SectionLabel>Admin Tools</SectionLabel>
      <div style={{ padding:'14px 20px 20px' }}>
        <MenuRow label="Manage Drivers" sub="Cup one-offs + bonus pools" onClick={() => setScreen('manage-drivers')}/>
        <MenuRow label="Download Backup" sub="Save the full league state as JSON to your device" onClick={() => downloadLeagueBackup(state)} last/>
      </div>
      <SectionLabel>Danger Zone</SectionLabel>
      <div style={{ padding:'14px 20px 40px' }}>
        <MenuRow label={resetArm ? 'Tap again to confirm' : 'Reset Season'} sub={resetArm ? 'This erases all picks & results' : 'Erase all results & drafts'} onClick={armReset} last/>
      </div>
    </>}
  </div>;
}
