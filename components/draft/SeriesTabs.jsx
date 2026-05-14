'use client';
import React from 'react';
import { FB, FL, SERIES, T } from '@/lib/constants';
import { countPicksBySeries } from '@/lib/utils';

// Series tab strip.
// Shown only on weeks with bonus rounds. Each tab displays "Cup 2/4"
// where 2 is picks-used by the current picker and 4 is their allotment.
// Tabs that are maxed are disabled. Tabs whose pool is empty get a hint.
export function SeriesTabs({ cfg, picks, pickerId, active, onSelect, bonusPools }) {
  return <div style={{ padding:'10px 20px 0' }}>
    <div style={{
      display:'flex', gap:6, overflowX:'auto', paddingBottom:6,
    }}>
      {Object.entries(cfg.allotments).map(([series, max]) => {
        const used = countPicksBySeries(picks, pickerId, series);
        const remaining = max - used;
        const pool = series === 'Cup' ? null : (bonusPools[series] || []);
        const poolEmpty = pool && pool.length === 0;
        const disabled = remaining <= 0 || poolEmpty;
        const isActive = active === series;
        const meta = SERIES[series] || { label: series, short: series.slice(0,3).toUpperCase() };
        return <button
          key={series}
          onClick={() => !disabled && onSelect(series)}
          disabled={disabled}
          style={{
            appearance:'none', flexShrink:0,
            padding:'8px 14px',
            background: isActive ? T.ink : (disabled ? T.bg2 : T.card),
            color: isActive ? T.bg : (disabled ? T.mute : T.ink),
            border:`1px solid ${isActive ? T.ink : T.line}`,
            borderRadius:3,
            cursor: disabled ? 'default' : 'pointer',
            fontFamily: FL, fontSize:10, fontWeight:600,
            letterSpacing:'0.18em', textTransform:'uppercase',
            display:'flex', alignItems:'center', gap:8,
            opacity: disabled ? 0.55 : 1,
          }}
          title={poolEmpty ? 'Admin has not added drivers for this series yet' : undefined}
        >
          <span>{meta.label}</span>
          <span style={{ fontFamily: FB, fontSize:11, fontWeight:600, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.01em', color: isActive ? T.hot : T.mute }}>{used}/{max}</span>
        </button>;
      })}
    </div>
  </div>;
}
