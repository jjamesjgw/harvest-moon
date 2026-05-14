// Design tokens — Harvest Moon palette
export const T = {
  bg: '#F7F4ED', bg2: '#EFEBE0', card: '#FDFBF5',
  ink: '#14110D', ink2: '#3D3830', mute: '#86806F',
  line: 'rgba(20,17,13,0.10)', line2: 'rgba(20,17,13,0.05)',
  hot: '#B8935A', good: '#5A7A5E', warn: '#B5823A',
  // Destructive UI (reset modal, validation errors). Use rgba()
  // wrappers for tinted/disabled variants rather than adding more tokens.
  danger: '#C8102E',
  // Dark shell surfaces — the body background outside the app frame
  // (`shell`) and the dark nav bands inside it (`nav`, slightly lifted
  // off `shell`/`ink` for layered depth).
  shell: '#0a0806',
  nav:   '#1c1a16',
  // Copper gradient used on hero CTAs (YourTurnToast, EnterResults
  // prompt, Login submit). 3 stops keeps the highlight band visible.
  copperGradient: 'linear-gradient(180deg, #C9A268 0%, #B8935A 50%, #9A7A48 100%)',
  // Cream surface gradient used on raised tiles (LoginScreen player
  // tiles, admin card, PIN field). Cheaper than per-site duplication.
  cardGradient:   'linear-gradient(180deg, #FDFBF5 0%, #EFEBE0 100%)',
};

// Font stacks
export const FD = "'Archivo', 'Helvetica Neue', -apple-system, sans-serif";          // display
export const FI = "'Fraunces', 'Cormorant Garamond', Georgia, serif";                 // italic serif
export const FL = "'Archivo Narrow', 'Archivo', 'Manrope', sans-serif";               // labels
export const FB = "'Manrope', -apple-system, system-ui, sans-serif";                  // body
export const FM = "'JetBrains Mono', ui-monospace, monospace";                        // mono

// League constants
export const ROUNDS_PER_WEEK = 4;

// Bonus series — supplemental races we draft from on certain weeks. Each
// series gets its own driver pool per week (admin populates manually before
// the draft) and counts toward the same season points as Cup picks.
//   id     → stable identifier stored in pick records and config
//   label  → human-friendly UI string
//   short  → 1-3 char tag for compact UI (chips, share card)
//   color  → accent color used to distinguish bonus picks visually
export const SERIES = {
  Cup:       { id: 'Cup',       label: 'Cup',           short: 'CUP', color: '#14110D' },
  Truck:     { id: 'Truck',     label: 'Truck Race',    short: 'TRK', color: '#9C4A2F' },
  OReilly:   { id: 'OReilly',   label: "O'Reilly",      short: "O'R", color: '#5A7A5E' },
  HighLimit: { id: 'HighLimit', label: 'High Limit',    short: 'HL',  color: '#3D6B6B' },
};
export const BONUS_SERIES_IDS = ['Truck', 'OReilly', 'HighLimit'];

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

