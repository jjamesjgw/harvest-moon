'use client';
import React from 'react';
import { BackChip, TopBar } from '@/components/ui/primitives';
import { FD, FL, ROUNDS_PER_WEEK, T } from '@/lib/constants';

export default function RulesScreen({ state, onBack }) {
  const rules = [
    ['Roster Size', `${ROUNDS_PER_WEEK} drivers per player per week`],
    ['Series', 'NASCAR Cup Series · other-series bonuses via override'],
    ['Re-draft', 'New snake draft every week after results are saved'],
    ['Draft Order', 'Worst to first by season pts · first place is auto-assigned the remaining slot'],
    ['Draft Format', `Snake · ${ROUNDS_PER_WEEK} rounds, direction alternates each round`],
    ['Selection', 'Each driver can only be on one roster per week'],
    ['Scoring', 'Official NASCAR Cup Series points, auto-pulled after the race'],
    ['Season', `${state.schedule.length} races · weekly winner takes bragging rights`],
  ];
  return <div style={{ paddingBottom:20 }}>
    <TopBar subtitle="League Rules" title="Rules" right={<BackChip onClick={onBack}/>}/>
    <div style={{ padding:'14px 20px' }}>
      {rules.map(([k, v], i) => (
        <div key={k} style={{
          padding:'18px 0',
          borderBottom: i === rules.length-1 ? 'none' : `0.5px solid ${T.line2}`,
        }}>
          <div style={{ fontFamily: FL, fontSize:9, fontWeight:500, letterSpacing:'0.24em', textTransform:'uppercase', color: T.mute }}>{k}</div>
          <div style={{ fontFamily: FD, fontSize:18, fontWeight:600, letterSpacing:'-0.03em', color: T.ink, marginTop:5 }}>{v}</div>
        </div>
      ))}
    </div>
  </div>;
}
