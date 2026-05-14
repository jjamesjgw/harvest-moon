'use client';
import React from 'react';
import { PlayerBadge } from '@/components/ui/primitives';
import { FB, FD, FI, FL, SERIES, T } from '@/lib/constants';
import { pickKey } from './pickKey';

// Latest picks strip.
// Three most recent picks, latest on top, all rendered at full ink intensity
// so the strip is uniformly readable. New arrivals get a brief copper-tinted
// background that fades to transparent over ~1s, riding the existing
// freshPickKeys signal so the visual matches the grid card flash.
//
// Stable React keys (`pick.at`) keep DOM nodes in place as new picks shift
// older ones down — so only the new top row is "new", the others slide
// without remounting. Bonus picks include a small series tag on the right
// so the source pool is visible without having to think about it.
export function LatestPicksStrip({ picks, players, freshPickKeys, lookupDriver, onNav }) {
  if (picks.length === 0) return null;
  const recent = picks.slice(-3).reverse();
  const total = picks.length;
  return (
    <div style={{ padding: '8px 20px 0' }}>
      {recent.map((pk, i) => {
        const player = players.find(p => p.id === pk.playerId);
        const series = pk.series || 'Cup';
        const driver = lookupDriver(series, pk.driverNum);
        const overallNum = total - i; // 1-indexed pick number; latest = highest
        const isFresh = freshPickKeys.has(pickKey(series, pk.driverNum));
        return (
          <div
            key={`${pk.at}-${pk.driverNum}-${series}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '6px 8px',
              background: isFresh ? 'rgba(184, 147, 90, 0.22)' : 'transparent',
              transition: 'background 1000ms ease-out',
              borderRadius: 3,
              borderBottom: i === recent.length - 1 ? 'none' : `0.5px solid ${T.line2}`,
            }}
          >
            <span style={{
              fontFamily: FB, fontSize: 9, fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              color: T.mute, minWidth: 18, textAlign: 'right',
              letterSpacing: '-0.01em',
            }}>
              {String(overallNum).padStart(2, '0')}
            </span>
            {player && <PlayerBadge player={player} size={18} onClick={() => onNav('team', { playerId: player.id })}/>}
            <span style={{
              fontFamily: FD, fontSize: 12, fontWeight: 600,
              letterSpacing: '-0.02em',
              color: T.ink,
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
            }}>
              {player?.name || '—'}
            </span>
            <span style={{
              fontFamily: FI, fontStyle: 'italic', fontSize: 11,
              color: T.mute, flex: '0 0 auto',
            }}>→</span>
            <span style={{
              fontFamily: FB, fontSize: 11, fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: T.ink, letterSpacing: '-0.01em',
              flex: '0 0 auto',
            }}>
              #{pk.driverNum}
            </span>
            <span style={{
              fontFamily: FD, fontSize: 12, fontWeight: 600,
              letterSpacing: '-0.02em',
              color: T.ink,
              flex: 1, minWidth: 0,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {driver?.name || pk.driverName || ''}
            </span>
            {series !== 'Cup' && <span style={{
              fontFamily: FL, fontSize: 8, fontWeight: 600,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: T.hot, flex: '0 0 auto',
            }}>
              {(SERIES[series]?.short) || series.slice(0, 3).toUpperCase()}
            </span>}
          </div>
        );
      })}
    </div>
  );
}
