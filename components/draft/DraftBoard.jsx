'use client';
import React, { useMemo } from 'react';
import { CarNum, PlayerBadge } from '@/components/ui/primitives';
import { FB, FD, FI, FL, SERIES, T } from '@/lib/constants';
import { pickKey } from './pickKey';

// Draft board.
// Full snake grid view. Columns are players in slot order (left to right);
// rows are rounds (top to bottom). Each cell is the driver picked at that
// (round, slot) intersection, or a dashed placeholder if the pick hasn't
// happened yet. The on-the-clock cell gets a copper outline; freshly-landed
// picks ride the same hm-pickring animation used in the grid for visual
// consistency. Round labels include a snake direction arrow so the
// chronological flow is obvious at a glance.
export function DraftBoard({ snakeOrder, picks, players, slotAssign, totalRounds, currentPickIdx, freshPickKeys, lookupDriver, onNav }) {
  const numPlayers = players.length;

  // (round, slot) → overall pick index. Lets us look up "what's at row 3,
  // col 2?" by indexing snakeOrder, which already encodes the snake.
  const slotByRoundIdx = useMemo(() => {
    const grid = {};
    for (let i = 0; i < snakeOrder.length; i++) {
      const { round, slot } = snakeOrder[i];
      if (!grid[round]) grid[round] = {};
      grid[round][slot] = i;
    }
    return grid;
  }, [snakeOrder]);

  // Players ordered by slot 1..N so the column header reads slot-1 leftmost.
  const playersBySlot = useMemo(() => {
    const out = [];
    const byId = new Map(players.map(p => [p.id, p]));
    for (let s = 1; s <= numPlayers; s++) {
      const entry = Object.entries(slotAssign || {}).find(([, sl]) => sl === s);
      out.push(entry ? byId.get(entry[0]) : null);
    }
    return out;
  }, [players, slotAssign, numPlayers]);

  // Track-style template: 28px gutter for round labels, equal columns per player.
  const cols = `28px repeat(${numPlayers}, minmax(0, 1fr))`;

  return (
    <div style={{ padding: '14px 14px 24px' }}>
      {/* Player header row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: cols,
        gap: 4,
        marginBottom: 8,
        alignItems: 'flex-end',
      }}>
        <div/>
        {playersBySlot.map((p, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 4,
            padding: '4px 0',
            minWidth: 0,
          }}>
            {p ? <PlayerBadge player={p} size={20} onClick={() => onNav('team', { playerId: p.id })}/> : <div style={{ width: 20, height: 20 }}/>}
            <div style={{
              fontFamily: FL, fontSize: 7, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: T.ink2,
              maxWidth: '100%',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {p?.name?.slice(0, 5) || '—'}
            </div>
          </div>
        ))}
      </div>

      {/* Round rows */}
      {Array.from({ length: totalRounds }, (_, r) => {
        const round = r + 1;
        const leftToRight = round % 2 === 1;
        const arrow = leftToRight ? '→' : '←';
        return (
          <div key={round} style={{
            display: 'grid',
            gridTemplateColumns: cols,
            gap: 4,
            marginBottom: 4,
          }}>
            {/* Round label gutter */}
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}>
              <div style={{
                fontFamily: FB, fontSize: 11, fontWeight: 700,
                color: T.ink2, letterSpacing: '-0.01em',
              }}>R{round}</div>
              <div style={{
                fontFamily: FB, fontSize: 9,
                color: T.mute, lineHeight: 1, marginTop: 1,
              }}>{arrow}</div>
            </div>
            {playersBySlot.map((p, i) => {
              const slot = i + 1;
              const overallIdx = slotByRoundIdx[round]?.[slot];
              const pk = (overallIdx != null && overallIdx < picks.length) ? picks[overallIdx] : null;
              const series = pk?.series || 'Cup';
              const driver = pk ? lookupDriver(series, pk.driverNum) : null;
              const isCurrent = overallIdx === currentPickIdx;
              const isFresh = pk ? freshPickKeys.has(pickKey(series, pk.driverNum)) : false;
              const filled = !!pk;
              const lastName = driver?.name?.split(' ').slice(-1)[0] || (pk?.driverName?.split(' ').slice(-1)[0]) || (pk ? `#${pk.driverNum}` : '');
              return (
                <div key={i} style={{
                  position: 'relative',
                  border: filled
                    ? `1px solid ${T.line}`
                    : `1px dashed ${isCurrent ? T.hot : T.line2}`,
                  borderRadius: 4,
                  padding: '4px 2px',
                  height: 58,
                  background: filled ? T.card : 'transparent',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 2,
                  minWidth: 0,
                  animation: isFresh ? 'hm-pickring 900ms ease-out forwards' : 'none',
                  boxShadow: isCurrent && !filled ? `0 0 0 1px ${T.hot}, inset 0 0 0 1px rgba(184,147,90,0.18)` : 'none',
                }}>
                  {filled ? (
                    driver ? <>
                      <CarNum driver={driver} size={22} onClick={series === 'Cup' ? () => onNav('drivers', { driverNum: driver.num }) : undefined}/>
                      <div style={{
                        fontFamily: FD, fontSize: 9, fontWeight: 600,
                        letterSpacing: '-0.02em',
                        color: T.ink,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        width: '100%', textAlign: 'center',
                        lineHeight: 1.05,
                      }}>
                        {lastName.slice(0, 6)}
                      </div>
                      <div style={{
                        position: 'absolute', top: 2, right: 3,
                        fontFamily: FB, fontSize: 7, fontWeight: 700,
                        color: T.mute,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {overallIdx + 1}
                      </div>
                      {series !== 'Cup' && <div style={{
                        position: 'absolute', bottom: 1, left: 2,
                        fontFamily: FL, fontSize: 6, fontWeight: 700,
                        color: T.hot,
                        letterSpacing: '0.15em', textTransform: 'uppercase',
                      }}>
                        {SERIES[series]?.short || series.slice(0, 3).toUpperCase()}
                      </div>}
                    </> : <>
                      {/* Pick exists but driver lookup failed — fallback. */}
                      <div style={{
                        fontFamily: FB, fontSize: 13, fontWeight: 700,
                        color: T.ink, fontVariantNumeric: 'tabular-nums',
                      }}>#{pk.driverNum}</div>
                      <div style={{
                        fontFamily: FD, fontSize: 9, color: T.mute,
                      }}>—</div>
                    </>
                  ) : (
                    <span style={{
                      fontFamily: FI, fontStyle: 'italic',
                      fontSize: isCurrent ? 14 : 11,
                      color: isCurrent ? T.hot : T.line2,
                      lineHeight: 1,
                    }}>
                      {isCurrent ? '⏱' : '·'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Quiet caption — explains the arrow column without crowding the grid. */}
      <div style={{
        marginTop: 14,
        fontFamily: FI, fontStyle: 'italic',
        fontSize: 11, color: T.mute,
        textAlign: 'center',
      }}>
        Snake order — direction reverses each round
      </div>
    </div>
  );
}
