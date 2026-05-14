// Static league data — drivers (with primary/secondary livery colors) and 36-race schedule.
// User-added one-off drivers are stored separately in state.weekDriversExtra.

// Common Cup Series liveries (approximate). Edit in Manage Drivers.
export const DEFAULT_DRIVERS = [
  { num:  1, name:'Chastain',     team:'Trackhouse',  primary:'#003DA5', secondary:'#FFFFFF' }, // Busch Light — blue/white
  { num:  2, name:'Cindric',      team:'Penske',      primary:'#D4FF00', secondary:'#0033A0' }, // Menards/Discount Tire — neon yellow/blue
  { num:  3, name:'A. Dillon',    team:'RCR',         primary:'#F37021', secondary:'#1A1A1A' }, // Bass Pro — orange/black
  { num:  4, name:'Gragson',      team:'Front Row',   primary:'#E31837', secondary:'#FFD200' }, // Rush Truck — red/yellow
  { num:  5, name:'Larson',       team:'Hendrick',    primary:'#1E64C8', secondary:'#F2F2F2' }, // HendrickCars — blue/white
  { num:  6, name:'Keselowski',   team:'RFK',         primary:'#0A1F44', secondary:'#C8102E' }, // Build Submarines — navy/red
  { num:  7, name:'Suárez',       team:'Spire',       primary:'#0066B3', secondary:'#00A651' }, // Freeway Ins — blue/green
  { num:  8, name:'K. Busch',     team:'RCR',         primary:'#FFCB05', secondary:'#D2232A' }, // Cheddar's/Lucas — yellow/red
  { num:  9, name:'Elliott',      team:'Hendrick',    primary:'#002F6C', secondary:'#FFCB08' }, // NAPA — blue/yellow
  { num: 10, name:'T. Dillon',    team:'Kaulig',      primary:'#2D4A22', secondary:'#C9A227' }, // Grizzly — green/gold
  { num: 11, name:'Hamlin',       team:'JGR',         primary:'#0F8A8A', secondary:'#1B3A6E' }, // National Debt Relief — teal/blue
  { num: 12, name:'Blaney',       team:'Penske',      primary:'#CDFF00', secondary:'#1B3A8C' }, // Menards — neon yellow/blue (darker pairing distinct from #2)
  { num: 16, name:'Allmendinger', team:'Kaulig',      primary:'#F37021', secondary:'#FFFFFF' }, // Celsius — orange/white
  { num: 17, name:'Buescher',     team:'RFK',         primary:'#0033A0', secondary:'#00A651' }, // Fifth Third — blue/green
  { num: 19, name:'Briscoe',      team:'JGR',         primary:'#FF6600', secondary:'#000000' }, // Bass Pro — bold orange/black (distinct from #3 black-orange ratio)
  { num: 20, name:'Bell',         team:'JGR',         primary:'#FFC20E', secondary:'#000000' }, // DeWalt — yellow/black
  { num: 21, name:'Berry',        team:'Wood Bros.',  primary:'#C8102E', secondary:'#FFFFFF' }, // Motorcraft — red/white
  { num: 22, name:'Logano',       team:'Penske',      primary:'#FFD400', secondary:'#E4002B' }, // Shell Pennzoil — yellow/red
  { num: 23, name:'Wallace',      team:'23XI',        primary:'#DA291C', secondary:'#FFC72C' }, // McDonald's — red/yellow
  { num: 24, name:'Byron',        team:'Hendrick',    primary:'#1B3A8C', secondary:'#39FF14' }, // Liberty/Raptor — navy/neon green
  { num: 34, name:'Gilliland',    team:'Front Row',   primary:'#FFD400', secondary:'#E31837' }, // Love's — yellow/red
  { num: 35, name:'Herbst',       team:'23XI',        primary:'#000000', secondary:'#00E83C' }, // Monster — black/neon green
  { num: 38, name:'Z. Smith',     team:'Front Row',   primary:'#F4B400', secondary:'#B40000' }, // Speedy Cash — gold-yellow/dark red (distinct from #34)
  { num: 41, name:'Custer',       team:'Haas',        primary:'#E31837', secondary:'#1A1A1A' }, // Haas — red/black
  { num: 42, name:'Nemechek',     team:'Legacy',      primary:'#008751', secondary:'#FFFFFF' }, // Dollar Tree — green/white
  { num: 43, name:'Jones',        team:'Legacy',      primary:'#0066A4', secondary:'#8BC53F' }, // Dollar Tree/AdventHealth — blue/green
  { num: 45, name:'Reddick',      team:'23XI',        primary:'#1F3A93', secondary:'#D4AF37' }, // Chumba — blue/gold
  { num: 47, name:'Stenhouse',    team:'Hyak',        primary:'#F2F2F2', secondary:'#FF6A00' }, // Chef Boyardee/NOS — white/orange
  { num: 48, name:'Bowman',       team:'Hendrick',    primary:'#5F27CD', secondary:'#FF6FB5' }, // Ally — purple/pink
  { num: 51, name:'Ware',         team:'Rick Ware',   primary:'#A91D2A', secondary:'#F7F4ED' }, // Parts Plus — deeper red/cream (distinct from #21)
  { num: 54, name:'T. Gibbs',     team:'JGR',         primary:'#1A1A1A', secondary:'#7CFC00' }, // Monster — black/lime variant (distinct from #35)
  { num: 60, name:'Preece',       team:'RFK',         primary:'#1B3A6E', secondary:'#F2F2F2' }, // Build Submarines — navy/white (distinct from #6 with no red)
  { num: 71, name:'McDowell',     team:'Spire',       primary:'#3CA0E7', secondary:'#FFFFFF' }, // Workforce — sky blue/white
  { num: 77, name:'Hocevar',      team:'Spire',       primary:'#004B8D', secondary:'#FFD200' }, // Zeigler — blue/yellow
  { num: 88, name:'Zilisch',      team:'Trackhouse',  primary:'#001489', secondary:'#FFC72C' }, // Red Bull — navy/yellow
  { num: 97, name:'van Gisbergen',team:'Trackhouse',  primary:'#FFFFFF', secondary:'#C8102E' }, // WeatherTech — white/red
];

// Each race carries:
//   - track + type + len + laps  → physical race info
//   - date + time + network       → broadcast / countdown info
//   - raceName                    → the official 2026 sponsored name (e.g. "Wurth 400")
//   - lastWinner                  → 2025 winner of the same track + similar slot (spring vs fall, etc.)
// Where lastWinner is `null`, the race is new for 2026 (San Diego, Wilkesboro, Chicagoland)
// or the configuration changed enough that prior-year data isn't comparable (Charlotte oval).
//
// `format: 'all-star'` marks the non-points exhibition. For those weeks there
// is no slot-pick / snake draft; every player has a single pre-locked pick in
// `allStarPicks` and the only scoring is a 50-point all-or-nothing bonus to
// each player who picked the winner.
export const DEFAULT_SCHEDULE = [
  { wk: 1,  track: 'Daytona',         type: 'Superspeedway', len: 2.5,  laps: 200, date: 'Feb 15', time: '2:30 PM ET',  network: 'FOX',   raceName: 'Daytona 500',                     lastWinner: 'William Byron' },
  { wk: 2,  track: 'Atlanta',         type: 'Superspeedway', len: 1.54, laps: 260, date: 'Feb 22', time: '3:00 PM ET',  network: 'FOX',   raceName: 'Ambetter Health 400',             lastWinner: 'Christopher Bell' },
  { wk: 3,  track: 'COTA',            type: 'Road Course',   len: 3.41, laps:  95, date: 'Mar 01', time: '3:30 PM ET',  network: 'FOX',   raceName: 'EchoPark Automotive Grand Prix',  lastWinner: 'Christopher Bell' },
  { wk: 4,  track: 'Phoenix',         type: 'Short Oval',    len: 1.0,  laps: 312, date: 'Mar 08', time: '3:30 PM ET',  network: 'FS1',   raceName: "Shriners Children's 500",         lastWinner: 'Christopher Bell' },
  { wk: 5,  track: 'Las Vegas',       type: 'Intermediate',  len: 1.5,  laps: 267, date: 'Mar 15', time: '3:30 PM ET',  network: 'FS1',   raceName: 'Pennzoil 400',                    lastWinner: 'Josh Berry' },
  { wk: 6,  track: 'Darlington',      type: 'Intermediate',  len: 1.37, laps: 293, date: 'Mar 22', time: '3:30 PM ET',  network: 'FS1',   raceName: 'Goodyear 400',                    lastWinner: 'Denny Hamlin' },
  { wk: 7,  track: 'Martinsville',    type: 'Short Oval',    len: 0.53, laps: 400, date: 'Mar 29', time: '3:00 PM ET',  network: 'FS1',   raceName: 'Cook Out 400',                    lastWinner: 'Denny Hamlin' },
  { wk: 8,  track: 'Bristol',         type: 'Short Oval',    len: 0.53, laps: 500, date: 'Apr 12', time: '3:30 PM ET',  network: 'FOX',   raceName: 'Food City 500',                   lastWinner: 'Kyle Larson' },
  { wk: 9,  track: 'Kansas',          type: 'Intermediate',  len: 1.5,  laps: 267, date: 'Apr 19', time: '3:00 PM ET',  network: 'FS1',   raceName: 'AdventHealth 400',                lastWinner: 'Kyle Larson' },
  { wk: 10, track: 'Talladega',       type: 'Superspeedway', len: 2.66, laps: 188, date: 'Apr 26', time: '3:00 PM ET',  network: 'FOX',   raceName: "Jack Link's 500",                 lastWinner: 'Austin Cindric' },
  { wk: 11, track: 'Texas',           type: 'Intermediate',  len: 1.5,  laps: 267, date: 'May 03', time: '3:30 PM ET',  network: 'FS1',   raceName: 'Würth 400',                       lastWinner: 'Joey Logano' },
  { wk: 12, track: 'Watkins Glen',    type: 'Road Course',   len: 2.45, laps:  90, date: 'May 10', time: '3:00 PM ET',  network: 'FS1',   raceName: 'Go Bowling at The Glen',          lastWinner: 'Shane van Gisbergen' },
  // Wk 13 — Dover All-Star Race (May 17, 2026). Non-points exhibition.
  // Each player has a single locked pick; 50-pt all-or-nothing bonus to
  // anyone who picked the race winner. No regular draft.
  { wk: 13, track: 'Dover',           type: 'Short Oval',    len: 1.0,  laps: 250, date: 'May 17', time: '12:00 PM ET', network: 'FS1',   raceName: 'NASCAR All-Star Race',            lastWinner: null, format: 'all-star',
    allStarPicks: {
      p_chad:   45, // Reddick
      p_trey:   11, // Hamlin
      p_soup:   11, // Hamlin
      p_tone:   20, // Bell
      p_justin:  9, // Elliott
      p_boomer:  9, // Elliott
    } },
  { wk: 14, track: 'Charlotte',       type: 'Intermediate',  len: 1.5,  laps: 400, date: 'May 24', time: '6:00 PM ET',  network: 'Prime', raceName: 'Coca-Cola 600',                   lastWinner: 'Ross Chastain' },
  { wk: 15, track: 'Nashville',       type: 'Intermediate',  len: 1.33, laps: 300, date: 'May 31', time: '3:30 PM ET',  network: 'Prime', raceName: 'Cracker Barrel 400',              lastWinner: 'Ryan Blaney' },
  { wk: 16, track: 'Michigan',        type: 'Intermediate',  len: 2.0,  laps: 200, date: 'Jun 07', time: '3:00 PM ET',  network: 'Prime', raceName: 'FireKeepers Casino 400',          lastWinner: 'Denny Hamlin' },
  { wk: 17, track: 'Pocono',          type: 'Intermediate',  len: 2.5,  laps: 160, date: 'Jun 14', time: '3:00 PM ET',  network: 'Prime', raceName: 'Great American Getaway 400',      lastWinner: 'Chase Briscoe' },
  { wk: 18, track: 'San Diego',       type: 'Street',        len: 3.0,  laps:  83, date: 'Jun 21', time: '3:30 PM ET',  network: 'Prime', raceName: 'Coronado Cup',                    lastWinner: null },
  { wk: 19, track: 'Sonoma',          type: 'Road Course',   len: 1.99, laps: 110, date: 'Jun 28', time: '3:30 PM ET',  network: 'TNT',   raceName: 'Toyota/Save Mart 350',            lastWinner: 'Shane van Gisbergen' },
  { wk: 20, track: 'Chicagoland',     type: 'Intermediate',  len: 1.5,  laps: 267, date: 'Jul 05', time: '3:30 PM ET',  network: 'TNT',   raceName: 'Grant Park 165',                  lastWinner: null },
  { wk: 21, track: 'Atlanta (II)',    type: 'Superspeedway', len: 1.54, laps: 260, date: 'Jul 12', time: '7:00 PM ET',  network: 'TNT',   raceName: 'Quaker State 400',                lastWinner: 'Chase Elliott' },
  { wk: 22, track: 'N. Wilkesboro',   type: 'Short Oval',    len: 0.63, laps: 400, date: 'Jul 19', time: '3:30 PM ET',  network: 'TNT',   raceName: 'NASCAR North Wilkesboro 250',     lastWinner: null },
  { wk: 23, track: 'Indianapolis',    type: 'Intermediate',  len: 2.5,  laps: 160, date: 'Jul 26', time: '2:00 PM ET',  network: 'TNT',   raceName: 'Brickyard 400',                   lastWinner: 'Bubba Wallace' },
  { wk: 24, track: 'Iowa',            type: 'Short Oval',    len: 0.88, laps: 350, date: 'Aug 09', time: '3:30 PM ET',  network: 'USA',   raceName: 'Iowa Corn 350',                   lastWinner: 'William Byron' },
  { wk: 25, track: 'Richmond',        type: 'Short Oval',    len: 0.75, laps: 400, date: 'Aug 15', time: '7:00 PM ET',  network: 'USA',   raceName: 'Cook Out 400',                    lastWinner: 'Austin Dillon' },
  { wk: 26, track: 'New Hampshire',   type: 'Short Oval',    len: 1.06, laps: 301, date: 'Aug 23', time: '3:00 PM ET',  network: 'USA',   raceName: 'Mobil 1 301',                     lastWinner: 'Ryan Blaney' },
  { wk: 27, track: 'Daytona (II)',    type: 'Superspeedway', len: 2.5,  laps: 160, date: 'Aug 29', time: '7:30 PM ET',  network: 'NBC',   raceName: 'Coke Zero Sugar 400',             lastWinner: 'Ryan Blaney' },
  { wk: 28, track: 'Darlington (II)', type: 'Intermediate',  len: 1.37, laps: 367, date: 'Sep 06', time: '5:00 PM ET',  network: 'USA',   raceName: 'Cook Out Southern 500',           lastWinner: 'Chase Briscoe' },
  { wk: 29, track: 'Gateway',         type: 'Short Oval',    len: 1.25, laps: 240, date: 'Sep 13', time: '3:00 PM ET',  network: 'USA',   raceName: 'Enjoy Illinois 300',              lastWinner: 'Denny Hamlin' },
  { wk: 30, track: 'Bristol (II)',    type: 'Short Oval',    len: 0.53, laps: 500, date: 'Sep 19', time: '7:30 PM ET',  network: 'USA',   raceName: 'Bass Pro Shops Night Race',       lastWinner: 'Christopher Bell' },
  { wk: 31, track: 'Kansas (II)',     type: 'Intermediate',  len: 1.5,  laps: 267, date: 'Sep 27', time: '3:00 PM ET',  network: 'USA',   raceName: 'Hollywood Casino 400',            lastWinner: 'Chase Elliott' },
  { wk: 32, track: 'Las Vegas (II)',  type: 'Intermediate',  len: 1.5,  laps: 267, date: 'Oct 04', time: '5:30 PM ET',  network: 'USA',   raceName: 'South Point 400',                 lastWinner: 'Denny Hamlin' },
  { wk: 33, track: 'Charlotte (II)',  type: 'Intermediate',  len: 1.5,  laps: 400, date: 'Oct 11', time: '3:00 PM ET',  network: 'USA',   raceName: 'Bank of America 400',             lastWinner: null },
  { wk: 34, track: 'Phoenix (II)',    type: 'Short Oval',    len: 1.0,  laps: 312, date: 'Oct 18', time: '3:00 PM ET',  network: 'USA',   raceName: 'Phoenix Autumn 312',              lastWinner: 'Ryan Blaney' },
  { wk: 35, track: 'Talladega (II)',  type: 'Superspeedway', len: 2.66, laps: 188, date: 'Oct 25', time: '2:00 PM ET',  network: 'NBC',   raceName: 'YellaWood 500',                   lastWinner: 'Chase Briscoe' },
  { wk: 36, track: 'Martinsville(II)',type: 'Short Oval',    len: 0.53, laps: 500, date: 'Nov 01', time: '2:00 PM ET',  network: 'NBC',   raceName: 'Xfinity 500',                     lastWinner: 'William Byron' },
  { wk: 37, track: 'Homestead',       type: 'Intermediate',  len: 1.5,  laps: 267, date: 'Nov 08', time: '3:00 PM ET',  network: 'NBC',   raceName: 'NASCAR Cup Series Championship',  lastWinner: 'Kyle Larson' },
];

// ── BONUS WEEK CONFIG ───────────────────────────────────────────────
// Maps wk → { allotments, seriesLabels }. Each allotment number is how
// many drivers from that series each player gets that week. Sum across
// allotments = total picks per player = total snake rounds for the week.
// Weeks NOT in this map default to plain Cup-only ({ Cup: 4 }).
//
// Bonus driver pools (the actual eligible drivers) are stored in state
// under `bonusDriversByWeek[wk][series] = [{ num, name, primary, secondary }]`
// because the admin populates them per weekend.
export const DEFAULT_WEEK_CONFIG = {
  // Wk 11 — Texas (May 3): TMS triple-header weekend with all three bonus series
  11: {
    allotments: { Cup: 4, Truck: 1, OReilly: 1, HighLimit: 1 },
  },
  // Wk 19 — Sonoma (Jun 28): O'Reilly Series ran Jun 27 at Sonoma
  19: {
    allotments: { Cup: 4, OReilly: 1 },
  },
  // Wk 22 — N. Wilkesboro (Jul 19): Trucks ran Jul 18 at N. Wilkesboro
  22: {
    allotments: { Cup: 4, Truck: 1 },
  },
  // Wk 27 — Daytona II (Aug 29): O'Reilly Series ran Aug 28 at Daytona
  27: {
    allotments: { Cup: 4, OReilly: 1 },
  },
};
