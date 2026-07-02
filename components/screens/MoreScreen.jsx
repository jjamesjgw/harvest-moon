'use client';
import React from 'react';
import { MenuRow, SectionLabel, TopBar } from '@/components/ui/primitives';
import { FD, FI, FL, T } from '@/lib/constants';

// Top-level menu. Was a long stack of 8-10 MenuRows in 4-5 SectionLabel
// groups; now condenses to a single profile row, three category cards
// (League / History / Commissioner) that open dedicated sub-screens via
// MoreSubScreen, and a sign-out row at the bottom. Category cards use a
// taller cream tile with kicker + display title + italic descriptor so
// each section gets a readable headline instead of a generic row.
export default function MoreScreen({ state, me, onNav, onSignOut }) {
  const { schedule, currentWeek, weeklyResults } = state;
  // Only weeks the season has moved past (wk ≤ currentWeek-1) count as the
  // "last result" for this descriptor — the current week's live/ingested row
  // isn't final yet and would disagree with the recap this links to.
  const lastResult = [...weeklyResults]
    .filter(w => w.wk <= currentWeek - 1)
    .sort((a, b) => b.wk - a.wk)[0];
  const isAdmin = !!me.isAdmin;

  return <div style={{ paddingBottom: 20 }}>
    <TopBar subtitle="League · Settings" title="More"/>

    <SectionLabel>Quick</SectionLabel>
    <div style={{ padding: '14px 20px 24px' }}>
      <MenuRow
        label="My Profile"
        sub="Nickname, color, favorite driver, notifications"
        onClick={() => onNav('profile')}
      />
      <MenuRow
        label="Schedule"
        sub={`${schedule.length} races · Wk ${currentWeek} of ${schedule.length}`}
        onClick={() => onNav('schedule')}
        last
      />
    </div>

    <SectionLabel>Sections</SectionLabel>
    <div style={{ padding: '14px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CategoryCard
        kicker="League"
        count={2}
        title="The Field"
        descriptor="Drivers and the rules of the road."
        onClick={() => onNav('more-league')}
      />
      <CategoryCard
        kicker="History"
        count={2}
        title="Past Weeks"
        descriptor={lastResult
          ? `Drafts, results, and a recap of ${lastResult.track}.`
          : 'Drafts, results, and the last race recap.'}
        onClick={() => onNav('more-history')}
      />
      {isAdmin && <CategoryCard
        kicker="Commissioner"
        count={3}
        title="League Tools"
        descriptor="Manage drivers, take a backup, reset the season."
        onClick={() => onNav('more-admin')}
      />}
    </div>

    <SectionLabel>Account</SectionLabel>
    <div style={{ padding: '14px 20px 40px' }}>
      <MenuRow
        label="Sign Out"
        sub="Return to league login"
        onClick={onSignOut}
        last
      />
    </div>
  </div>;
}

// Taller cream tile used for the three section entry points. Mirrors the
// MenuRow contract (label/sub/onClick) but with the editorial type stack
// for top-level navigation: copper kicker + count, FD title, FI descriptor.
function CategoryCard({ kicker, count, title, descriptor, onClick }) {
  return <button onClick={onClick} style={{
    appearance: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
    background: T.card,
    border: `0.5px solid ${T.line}`,
    borderRadius: 4,
    padding: '18px 20px',
    display: 'flex', alignItems: 'flex-start', gap: 14,
    boxShadow: '0 1px 2px rgba(20,17,13,0.04)',
  }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontFamily: FL, fontSize: 9, fontWeight: 600,
        letterSpacing: '0.24em', textTransform: 'uppercase',
        color: T.hot,
      }}>{kicker}{count != null ? ` · ${count}` : ''}</div>
      <div style={{
        fontFamily: FD, fontSize: 22, fontWeight: 600,
        letterSpacing: '-0.03em', color: T.ink,
        marginTop: 6, lineHeight: 1.1,
      }}>{title}</div>
      <div style={{
        fontFamily: FI, fontStyle: 'italic', fontSize: 13, color: T.mute,
        marginTop: 6, lineHeight: 1.5,
      }}>{descriptor}</div>
    </div>
    <div style={{
      fontFamily: FI, fontStyle: 'italic', fontSize: 18, color: T.mute,
      marginTop: 6,
    }}>→</div>
  </button>;
}
