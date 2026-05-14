'use client';
import React from 'react';
import { FL, T } from '@/lib/constants';

// Pick / Board mode toggle.
// Lightweight segmented control. Pick = driver pool grid for selecting.
// Board = full snake grid showing every pick made so far. Spectators
// (and the on-the-clock player between turns) flip to Board to see the
// whole state at a glance, then back to Pick to act when their turn comes.
export function ModeToggle({ mode, onChange }) {
  const opts = [
    { id: 'pick', label: 'Pick' },
    { id: 'board', label: 'Board' },
  ];
  return (
    <div style={{
      display: 'flex',
      borderRadius: 3,
      overflow: 'hidden',
      border: `1px solid ${T.line}`,
      background: T.card,
    }}>
      {opts.map(o => {
        const active = mode === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              appearance: 'none',
              flex: 1,
              background: active ? T.ink : 'transparent',
              color: active ? T.bg : T.ink,
              border: 'none',
              padding: '9px 16px',
              fontFamily: FL, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.22em', textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background 120ms ease, color 120ms ease',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
