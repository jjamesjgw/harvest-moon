'use client';
import React from 'react';
import { BackChip, SectionLabel, TopBar } from '@/components/ui/primitives';
import { FB, FD, FI, FL, ROUNDS_PER_WEEK, T } from '@/lib/constants';

// Single rule row — copper accent on the term, dark body text underneath.
// Used for both definitional facts and step-by-step procedure explanations.
function Rule({ term, children, last }) {
  return <div style={{
    padding:'16px 0',
    borderBottom: last ? 'none' : `0.5px solid ${T.line2}`,
  }}>
    <div style={{
      fontFamily: FL, fontSize:9, fontWeight:600,
      letterSpacing:'0.24em', textTransform:'uppercase', color: T.hot,
    }}>{term}</div>
    <div style={{
      fontFamily: FB, fontSize:14, fontWeight:400,
      lineHeight:1.55, color: T.ink, marginTop:6,
    }}>{children}</div>
  </div>;
}

// Numbered tiebreaker step — the cascade is the trickiest concept on this
// screen, so each level gets its own visually distinct row.
function CascadeStep({ n, label, children }) {
  return <div style={{ display:'flex', gap:12, padding:'10px 0' }}>
    <div style={{
      fontFamily: FD, fontSize:18, fontWeight:600, color: T.hot,
      width:22, lineHeight:1, fontVariantNumeric:'tabular-nums', flexShrink:0,
    }}>{n}</div>
    <div style={{ flex:1 }}>
      <div style={{ fontFamily: FD, fontSize:15, fontWeight:600, letterSpacing:'-0.02em', color: T.ink }}>{label}</div>
      <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, color: T.ink2, marginTop:2, lineHeight:1.5 }}>{children}</div>
    </div>
  </div>;
}

export default function RulesScreen({ state, onBack }) {
  const totalRaces = state.schedule.length;
  const playerCount = state.players.length;
  const totalPicks = ROUNDS_PER_WEEK * playerCount;

  return <div style={{ paddingBottom:30 }}>
    <TopBar subtitle="How the league works" title="Rules" right={<BackChip onClick={onBack}/>}/>

    <SectionLabel>Format</SectionLabel>
    <div style={{ padding:'8px 20px 20px' }}>
      <Rule term="Season Length">
        {totalRaces} NASCAR Cup Series races, mid-February through November.
      </Rule>
      <Rule term="Roster Size">
        {ROUNDS_PER_WEEK} Cup drivers per player per week. With {playerCount} players that's {totalPicks} Cup picks
        most weeks — each driver belongs to exactly one player for that race.
      </Rule>
      <Rule term="Re-Draft Each Week">
        Rosters reset every week. After Save & Advance locks the previous race,
        the league redrafts from scratch for the next one.
      </Rule>
      <Rule term="Scoring" last>
        Official NASCAR Cup Series points. The commissioner enters each driver's
        race result; the app totals each player's roster automatically. Bonus picks
        count toward the same weekly total as Cup picks.
      </Rule>
    </div>

    <SectionLabel>Bonus Weeks</SectionLabel>
    <div style={{ padding:'8px 20px 20px' }}>
      <Rule term="What They Are">
        Some weekends have a supplemental race we draft from — a Truck race, an O'Reilly
        Series race, or a High Limit dirt race. On those weeks, every player picks one
        bonus driver from each scheduled bonus series in addition to their {ROUNDS_PER_WEEK} Cup drivers.
      </Rule>
      <Rule term="When They Happen">
        Texas weekend (3 bonus series — Truck, O'Reilly, High Limit), Sonoma (O'Reilly),
        N. Wilkesboro (Truck), and Daytona summer (O'Reilly).
      </Rule>
      <Rule term="How They're Drafted">
        The snake draft just runs more rounds. When it's your turn, you pick from any
        series you still have allotment for — Cup or any bonus series. You can take all
        Cup first then bonuses, or interleave however you want. Each series has its own
        driver pool.
      </Rule>
      <Rule term="Scoring" last>
        Bonus driver points get entered the same way Cup points are. They roll up into
        your weekly total and your season standings exactly like Cup picks.
      </Rule>
    </div>

    <SectionLabel>The Weekly Draft</SectionLabel>
    <div style={{ padding:'8px 20px 20px' }}>
      <Rule term="Step 1 · Slot Picks">
        Players pick their <em>slot</em> in draft order one at a time — slot 1 picks first
        in the snake draft, slot {playerCount} picks last (and gets the auto-snake-back).
        The order players pick their slots is set by reverse standings (worst to first).
      </Rule>
      <Rule term="Step 2 · Countdown">
        Once every slot is locked, a 3-2-1 countdown auto-fires. The snake draft
        starts the moment it hits GO!
      </Rule>
      <Rule term="Step 3 · Snake Draft">
        {ROUNDS_PER_WEEK} rounds. Direction reverses each round —
        slot 1 picks first in round 1, last in round 2, first in round 3, etc.
        Only the player on the clock can lock a pick (or the commissioner overriding).
      </Rule>
      <Rule term="Undo" last>
        Picks can be undone, but only by the player who made them or the commissioner.
        Undoing rolls the clock back one slot.
      </Rule>
    </div>

    <SectionLabel>Slot-Pick Order Cascade</SectionLabel>
    <div style={{ padding:'8px 20px 6px' }}>
      <div style={{
        fontFamily: FI, fontStyle:'italic', fontSize:13, color: T.ink2,
        lineHeight:1.55, paddingBottom:6,
      }}>
        Worst-to-first by season points — but ties happen, especially Week 1.
        The app resolves them in this order:
      </div>
    </div>
    <div style={{ padding:'4px 20px 20px' }}>
      <CascadeStep n="1" label="Lower season points picks first">
        Whoever is further behind in the season standings gets first dibs on their slot.
      </CascadeStep>
      <CascadeStep n="2" label="If tied, lower last-week points wins the tiebreaker">
        Two players locked on season points? The one who scored less last race goes first.
      </CascadeStep>
      <CascadeStep n="3" label="If still tied, alphabetical by name">
        Used in Week 1 (everyone has 0 season points) and any other dead heat.
        Boomer before Chad before Justin before Soup before Tone before Trey.
      </CascadeStep>
    </div>

    <SectionLabel>Saving the Week</SectionLabel>
    <div style={{ padding:'8px 20px 20px' }}>
      <Rule term="Live Scoring">
        Points update on every keystroke during result entry — the commissioner can
        see roster totals climb as they type each driver's finish.
      </Rule>
      <Rule term="Two-Tap Confirm">
        Save & Advance requires a confirm tap. Once finalized, the week locks and
        the league rolls to the next race's draft.
      </Rule>
      <Rule term="Past-Week Edits" last>
        The commissioner can edit any prior week's points from History → ✎ Edit.
        Useful for typos and post-race penalties.
      </Rule>
    </div>

    <SectionLabel>Drivers</SectionLabel>
    <div style={{ padding:'8px 20px 20px' }}>
      <Rule term="Default Pool">
        36 full-time Cup Series drivers, available every week.
      </Rule>
      <Rule term="One-Off Drivers">
        For races with part-time entries (Jimmie Johnson at the Daytona 500,
        Helio Castroneves wherever, etc.), the commissioner can add them to
        a specific week from More → Manage Drivers.
      </Rule>
      <Rule term="Validation" last>
        Numbers 0–999, names ≤ 24 characters, no duplicates within a week,
        primary livery color must differ from secondary.
      </Rule>
    </div>

    <SectionLabel>Commissioner</SectionLabel>
    <div style={{ padding:'8px 20px 30px' }}>
      <Rule term="Powers">
        Override picks for absent players · Edit past-week results ·
        Manage drivers · Reset the season · Download a JSON backup.
      </Rule>
      <Rule term="Backup" last>
        Run More → Admin Tools → Download Backup once a month. Saves the full
        league state as JSON — your insurance against accidental resets.
      </Rule>
    </div>
  </div>;
}
