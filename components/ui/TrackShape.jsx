'use client';
import React from 'react';
import { T } from '@/lib/constants';

// Maps a track name → a stylized SVG silhouette. Shapes are intentionally
// schematic, not architecturally accurate — they're meant to be recognizable
// at chip size (24-48px), not blueprint-accurate. Loose substring matching
// handles "(II)" suffixes and case variations.
//
// Shape categories:
//   road        — winding road courses (COTA, Watkins, Sonoma, San Diego)
//   triangle    — Pocono's tri-oval triangle
//   paperclip   — Martinsville's long narrow with rounded ends
//   egg         — Darlington's asymmetric "egg"
//   rectangle   — Indianapolis' near-square Brickyard
//   phoenix     — Phoenix's dogleg D
//   superspeedway — Daytona/Talladega/Atlanta tri-oval
//   short-oval  — round short tracks (Bristol/Iowa/Richmond/NHMS/Wilkesboro/Gateway)
//   tri-oval    — DEFAULT, intermediates (Vegas/Kansas/Texas/Charlotte/etc.)

function shapeOf(track) {
  const t = (track || '').toLowerCase();
  if (t.includes('cota') || t.includes('watkins') || t.includes('sonoma') || t.includes('san diego')) return 'road';
  if (t.includes('pocono')) return 'triangle';
  if (t.includes('martinsville')) return 'paperclip';
  if (t.includes('darlington')) return 'egg';
  if (t.includes('indianapolis')) return 'rectangle';
  if (t.includes('phoenix')) return 'phoenix';
  if (t.includes('daytona') || t.includes('talladega') || t.includes('atlanta')) return 'superspeedway';
  if (t.includes('bristol') || t.includes('iowa') || t.includes('wilkesboro') ||
      t.includes('richmond') || t.includes('new hampshire') || t.includes('gateway')) return 'short-oval';
  return 'tri-oval';
}

// SVG path data for each shape in a 100×60 viewBox.
const PATHS = {
  // Long oval with a slight peak on the front straight (the "tri" notch).
  superspeedway: 'M 20 10 L 50 6 L 80 10 Q 92 16 92 30 Q 92 44 80 50 L 50 54 L 20 50 Q 8 44 8 30 Q 8 16 20 10 Z',
  // Default intermediate D-tri-oval (Vegas, Kansas, Texas, Charlotte, Nashville, Michigan, Homestead, Chicagoland).
  'tri-oval':    'M 20 8 L 50 6 L 80 8 Q 92 14 92 30 Q 92 46 80 52 L 50 54 L 20 52 Q 8 46 8 30 Q 8 14 20 8 Z',
  // Round short ovals.
  'short-oval':  null, // rendered as <ellipse> below
  // Phoenix's distinctive dogleg between turns 1 and 2.
  phoenix:       'M 18 12 L 68 12 Q 80 12 86 20 L 92 32 Q 92 38 84 44 Q 76 48 66 48 L 18 48 Q 8 48 8 38 L 8 22 Q 8 12 18 12 Z',
  // Indianapolis Motor Speedway's near-square 2.5mi rectangle.
  rectangle:     'M 14 14 L 86 14 Q 92 14 92 20 L 92 40 Q 92 46 86 46 L 14 46 Q 8 46 8 40 L 8 20 Q 8 14 14 14 Z',
  // Darlington's egg: wider on Turn 1/2 end, narrower on Turn 3/4 end.
  egg:           'M 18 30 Q 18 10 40 10 L 72 14 Q 90 18 90 32 Q 90 46 72 48 L 40 48 Q 18 48 18 30 Z',
  // Martinsville's signature paperclip — long narrow with tight ends.
  paperclip:     'M 22 18 L 78 18 Q 92 18 92 30 Q 92 42 78 42 L 22 42 Q 8 42 8 30 Q 8 18 22 18 Z',
  // Pocono's distinctive triangular shape.
  triangle:      'M 50 6 L 92 50 L 8 50 Z',
  // Generic squiggly road course — not meant to match any specific track.
  road:          'M 8 30 Q 8 14 24 14 L 48 14 Q 56 14 56 22 L 56 32 Q 56 40 66 40 L 84 40 Q 92 40 92 34 L 92 22 Q 92 16 84 16 L 80 16 Q 74 16 74 22 L 74 42 Q 74 50 64 50 L 22 50 Q 8 50 8 40 Z',
};

export function TrackShape({ track, size = 28, color, stroke = 2.4, strokeOpacity }) {
  const shape = shapeOf(track);
  const w = size;
  const h = Math.round(size * 0.6);
  const sColor = color || T.mute;
  const common = {
    stroke: sColor,
    strokeWidth: stroke,
    strokeLinejoin: 'round',
    strokeLinecap: 'round',
    fill: 'none',
    strokeOpacity: strokeOpacity ?? 1,
  };
  if (shape === 'short-oval') {
    return <svg width={w} height={h} viewBox="0 0 100 60" style={{ display:'block' }}>
      <ellipse cx="50" cy="30" rx="40" ry="20" {...common}/>
    </svg>;
  }
  return <svg width={w} height={h} viewBox="0 0 100 60" style={{ display:'block' }}>
    <path d={PATHS[shape]} {...common}/>
  </svg>;
}
