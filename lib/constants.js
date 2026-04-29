// Design tokens — Harvest Moon palette
export const T = {
  bg: '#F7F4ED', bg2: '#EFEBE0', card: '#FDFBF5',
  ink: '#14110D', ink2: '#3D3830', mute: '#86806F',
  line: 'rgba(20,17,13,0.10)', line2: 'rgba(20,17,13,0.05)',
  hot: '#B8935A', good: '#5A7A5E', warn: '#B5823A',
};

// Font stacks
export const FD = "'Archivo', 'Helvetica Neue', -apple-system, sans-serif";          // display
export const FI = "'Fraunces', 'Cormorant Garamond', Georgia, serif";                 // italic serif
export const FL = "'Archivo Narrow', 'Archivo', 'Manrope', sans-serif";               // labels
export const FB = "'Manrope', -apple-system, system-ui, sans-serif";                  // body
export const FM = "'JetBrains Mono', ui-monospace, monospace";                        // mono

// League constants
export const ROUNDS_PER_WEEK = 4;
export const STORAGE_KEY = 'harvest-moon-league-v1';

// Admin account (separate from the 6 players)
export const ADMIN_ID = 'admin';
export const ADMIN_PROFILE = { id: ADMIN_ID, name: 'Admin', color: '#14110D', initial: 'A' };

// Hardcoded league roster + PINs. Keyed by lowercased name.
export const CANONICAL_PLAYERS = [
  { id: 'p_justin', name: 'Justin', color: '#B8935A', initial: 'J' },
  { id: 'p_soup',   name: 'Soup',   color: '#C06E52', initial: 'S' },
  { id: 'p_chad',   name: 'Chad',   color: '#9C4A2F', initial: 'C' },
  { id: 'p_tone',   name: 'Tone',   color: '#5A7A5E', initial: 'T' },
  { id: 'p_boomer', name: 'Boomer', color: '#3D6B6B', initial: 'B' },
  { id: 'p_trey',   name: 'Trey',   color: '#6B4A5E', initial: 'T' },
];

export const PLAYER_PINS = {
  justin: '0126',
  soup:   '4526',
  chad:   '0826',
  tone:   '1226',
  boomer: '0926',
  trey:   '2426',
  admin:  '3586',
};

// Color palette used by the legacy SetupScreen + Members color picker
export const PALETTE = [
  '#B8935A','#C06E52','#9C4A2F','#C9A227','#5A7A5E','#3D6B6B',
  '#4A5568','#14110D','#6B4A5E','#2C3E50','#7F2D3A','#4A5D3A',
];
