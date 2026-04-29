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

export const DEFAULT_SCHEDULE = [
  { wk: 1,  track: 'Daytona',         type: 'Superspeedway', len: 2.5,  laps: 200, date: 'Feb 15', time: '2:30 PM ET',  network: 'FOX' },
  { wk: 2,  track: 'Atlanta',         type: 'Superspeedway', len: 1.54, laps: 260, date: 'Feb 22', time: '3:00 PM ET',  network: 'FOX' },
  { wk: 3,  track: 'COTA',            type: 'Road Course',   len: 3.41, laps:  95, date: 'Mar 01', time: '3:30 PM ET',  network: 'FOX' },
  { wk: 4,  track: 'Phoenix',         type: 'Short Oval',    len: 1.0,  laps: 312, date: 'Mar 08', time: '3:30 PM ET',  network: 'FS1' },
  { wk: 5,  track: 'Las Vegas',       type: 'Intermediate',  len: 1.5,  laps: 267, date: 'Mar 15', time: '3:30 PM ET',  network: 'FS1' },
  { wk: 6,  track: 'Darlington',      type: 'Intermediate',  len: 1.37, laps: 293, date: 'Mar 22', time: '3:30 PM ET',  network: 'FS1' },
  { wk: 7,  track: 'Martinsville',    type: 'Short Oval',    len: 0.53, laps: 400, date: 'Mar 29', time: '3:00 PM ET',  network: 'FS1' },
  { wk: 8,  track: 'Bristol',         type: 'Short Oval',    len: 0.53, laps: 500, date: 'Apr 12', time: '3:30 PM ET',  network: 'FOX' },
  { wk: 9,  track: 'Kansas',          type: 'Intermediate',  len: 1.5,  laps: 267, date: 'Apr 19', time: '3:00 PM ET',  network: 'FS1' },
  { wk: 10, track: 'Talladega',       type: 'Superspeedway', len: 2.66, laps: 188, date: 'Apr 26', time: '3:00 PM ET',  network: 'FOX' },
  { wk: 11, track: 'Texas',           type: 'Intermediate',  len: 1.5,  laps: 267, date: 'May 03', time: '3:30 PM ET',  network: 'FS1' },
  { wk: 12, track: 'Watkins Glen',    type: 'Road Course',   len: 2.45, laps:  90, date: 'May 10', time: '3:00 PM ET',  network: 'FS1' },
  { wk: 13, track: 'Charlotte',       type: 'Intermediate',  len: 1.5,  laps: 400, date: 'May 24', time: '6:00 PM ET',  network: 'Prime' },
  { wk: 14, track: 'Nashville',       type: 'Intermediate',  len: 1.33, laps: 300, date: 'May 31', time: '3:30 PM ET',  network: 'Prime' },
  { wk: 15, track: 'Michigan',        type: 'Intermediate',  len: 2.0,  laps: 200, date: 'Jun 07', time: '3:00 PM ET',  network: 'Prime' },
  { wk: 16, track: 'Pocono',          type: 'Intermediate',  len: 2.5,  laps: 160, date: 'Jun 14', time: '3:00 PM ET',  network: 'Prime' },
  { wk: 17, track: 'San Diego',       type: 'Street',        len: 3.0,  laps:  83, date: 'Jun 21', time: '3:30 PM ET',  network: 'Prime' },
  { wk: 18, track: 'Sonoma',          type: 'Road Course',   len: 1.99, laps: 110, date: 'Jun 28', time: '3:30 PM ET',  network: 'TNT' },
  { wk: 19, track: 'Chicagoland',     type: 'Intermediate',  len: 1.5,  laps: 267, date: 'Jul 05', time: '3:30 PM ET',  network: 'TNT' },
  { wk: 20, track: 'Atlanta (II)',    type: 'Superspeedway', len: 1.54, laps: 260, date: 'Jul 12', time: '7:00 PM ET',  network: 'TNT' },
  { wk: 21, track: 'N. Wilkesboro',   type: 'Short Oval',    len: 0.63, laps: 400, date: 'Jul 19', time: '3:30 PM ET',  network: 'TNT' },
  { wk: 22, track: 'Indianapolis',    type: 'Intermediate',  len: 2.5,  laps: 160, date: 'Jul 26', time: '2:00 PM ET',  network: 'TNT' },
  { wk: 23, track: 'Iowa',            type: 'Short Oval',    len: 0.88, laps: 350, date: 'Aug 09', time: '3:30 PM ET',  network: 'USA' },
  { wk: 24, track: 'Richmond',        type: 'Short Oval',    len: 0.75, laps: 400, date: 'Aug 15', time: '7:00 PM ET',  network: 'USA' },
  { wk: 25, track: 'New Hampshire',   type: 'Short Oval',    len: 1.06, laps: 301, date: 'Aug 23', time: '3:00 PM ET',  network: 'USA' },
  { wk: 26, track: 'Daytona (II)',    type: 'Superspeedway', len: 2.5,  laps: 160, date: 'Aug 29', time: '7:30 PM ET',  network: 'NBC' },
  { wk: 27, track: 'Darlington (II)', type: 'Intermediate',  len: 1.37, laps: 367, date: 'Sep 06', time: '5:00 PM ET',  network: 'USA' },
  { wk: 28, track: 'Gateway',         type: 'Short Oval',    len: 1.25, laps: 240, date: 'Sep 13', time: '3:00 PM ET',  network: 'USA' },
  { wk: 29, track: 'Bristol (II)',    type: 'Short Oval',    len: 0.53, laps: 500, date: 'Sep 19', time: '7:30 PM ET',  network: 'USA' },
  { wk: 30, track: 'Kansas (II)',     type: 'Intermediate',  len: 1.5,  laps: 267, date: 'Sep 27', time: '3:00 PM ET',  network: 'USA' },
  { wk: 31, track: 'Las Vegas (II)',  type: 'Intermediate',  len: 1.5,  laps: 267, date: 'Oct 04', time: '5:30 PM ET',  network: 'USA' },
  { wk: 32, track: 'Charlotte (II)',  type: 'Intermediate',  len: 1.5,  laps: 400, date: 'Oct 11', time: '3:00 PM ET',  network: 'USA' },
  { wk: 33, track: 'Phoenix (II)',    type: 'Short Oval',    len: 1.0,  laps: 312, date: 'Oct 18', time: '3:00 PM ET',  network: 'USA' },
  { wk: 34, track: 'Talladega (II)',  type: 'Superspeedway', len: 2.66, laps: 188, date: 'Oct 25', time: '2:00 PM ET',  network: 'NBC' },
  { wk: 35, track: 'Martinsville(II)',type: 'Short Oval',    len: 0.53, laps: 500, date: 'Nov 01', time: '2:00 PM ET',  network: 'NBC' },
  { wk: 36, track: 'Homestead',       type: 'Intermediate',  len: 1.5,  laps: 267, date: 'Nov 08', time: '3:00 PM ET',  network: 'NBC' },
];

// Legacy roster used only by the orphaned SetupScreen. Kept for completeness.
export const DEFAULT_PLAYERS = [
  { id: 'p1', name: 'Justin', color: '#9C4A2F', initial: 'J' },
  { id: 'p2', name: 'Chad',   color: '#C9A227', initial: 'C' },
  { id: 'p3', name: 'Boomer', color: '#3D6B6B', initial: 'B' },
  { id: 'p4', name: 'Tone',   color: '#2C3E50', initial: 'T' },
  { id: 'p5', name: 'Soup',   color: '#6B4A5E', initial: 'S' },
  { id: 'p6', name: 'Trey',   color: '#5A7A5E', initial: 'Y' },
];
