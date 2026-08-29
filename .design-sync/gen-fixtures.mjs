import { writeFileSync } from 'node:fs';

// deterministic LCG - fixtures must be stable or every re-sync clears grades
let seed = 20260829;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const between = (a, b, dp = 2) => Number((a + rnd() * (b - a)).toFixed(dp));
const int = (a, b) => Math.floor(a + rnd() * (b - a + 1));
const pick = (arr) => arr[int(0, arr.length - 1)];

const LEAGUES = [
  { rank: 1, league: 'Premier Division', clubs: ['Arsenal', 'Chelsea', 'Liverpool', 'Man City', 'Newcastle', 'Tottenham'] },
  { rank: 2, league: 'La Liga', clubs: ['Real Betis', 'Sevilla', 'Villarreal', 'Athletic Club', 'Valencia'] },
  { rank: 3, league: 'Serie A', clubs: ['Atalanta', 'Bologna', 'Lazio', 'Torino', 'Fiorentina'] },
  { rank: 4, league: 'Bundesliga', clubs: ['VfB Stuttgart', 'Freiburg', 'Mainz 05', 'Werder Bremen'] },
  { rank: 5, league: 'Eredivisie', clubs: ['Feyenoord', 'AZ Alkmaar', 'FC Twente', 'Utrecht'] },
  { rank: 6, league: 'Primeira Liga', clubs: ['Sporting CP', 'Braga', 'Vitoria SC', 'Famalicao'] },
];

const ROLES = [
  { pos: [{ type: 'GK' }], n: 12, gk: true },
  { pos: [{ type: 'D', side: ['C'] }], n: 16 },
  { pos: [{ type: 'D', side: ['R'] }, { type: 'WB', side: ['R'] }], n: 10 },
  { pos: [{ type: 'D', side: ['L'] }, { type: 'WB', side: ['L'] }], n: 10 },
  { pos: [{ type: 'DM' }], n: 12 },
  { pos: [{ type: 'M', side: ['C'] }], n: 14 },
  { pos: [{ type: 'AM', side: ['C'] }], n: 12 },
  { pos: [{ type: 'AM', side: ['R'] }], n: 9 },
  { pos: [{ type: 'AM', side: ['L'] }], n: 9 },
  { pos: [{ type: 'ST', side: ['C'] }], n: 14 },
];

const FIRST = ['Mateo', 'Luka', 'Emeka', 'Tobias', 'Rafael', 'Andrej', 'Idrissa', 'Nico', 'Joan', 'Kasper', 'Milos', 'Youssef', 'Tomas', 'Bruno', 'Erik', 'Diogo', 'Sander', 'Amadou', 'Pavel', 'Lorenzo', 'Finn', 'Ousmane', 'Marek', 'Gabriel', 'Stefan', 'Jonas', 'Ricardo', 'Viktor', 'Adama', 'Nikola'];
const LAST = ['Ferran', 'Novak', 'Ofori', 'Lind', 'Pinto', 'Kovac', 'Diallo', 'Brandt', 'Serra', 'Holm', 'Petrovic', 'Benali', 'Vrba', 'Alves', 'Lindqvist', 'Moreira', 'Visser', 'Traore', 'Novotny', 'Ricci', 'Bakker', 'Camara', 'Hruska', 'Costa', 'Ilic', 'Berg', 'Silva', 'Marek', 'Toure', 'Jovanovic'];
const NATS = ['ENG', 'ESP', 'ITA', 'GER', 'NED', 'POR', 'FRA', 'BRA', 'ARG', 'SRB', 'CZE', 'DEN', 'SWE', 'NOR', 'SEN', 'MLI', 'CIV', 'GHA', 'CRO', 'POL'];

const outfield = () => ({
  PasPercentage: between(58, 93, 1), AssistsPer90: between(0, 0.5), xAPer90: between(0, 0.45),
  PrPassesPer90: between(0.8, 9), OPKPPer90: between(0, 2.4), ChCPer90: between(0, 2),
  OPCrPercentage: between(0, 42, 1), OPCrsCPer90: between(0, 2), ConvPercentage: between(0, 32, 1),
  xGOP: between(0, 0.7), ShTPer90: between(0, 2.5), ShotsOutsideBoxPer90: between(0, 2),
  goals90: between(0, 0.9), NPxGPer90: between(0, 0.8), GlMst: int(0, 5),
  TckPer90: between(0.2, 4), TckR: between(38, 92, 1), ClrPer90: between(0, 7),
  KTckPer90: between(0, 1), KHdrsPer90: between(0, 1.5), AerAPer90: between(0, 8),
  HdrPercentage: between(28, 82, 1), HdrsWPer90: between(0, 5), BlkPer90: between(0, 1.5),
  PossWonPer90: between(3, 12), PossLostPer90: between(5, 18), SprintsPer90: between(3, 20),
  DrbPer90: between(0, 4), DistPer90: between(8, 12.6), PresCPer90: between(2, 12), PresAPer90: between(8, 30),
  Svt: 0, Svp: 0, Svh: 0, xGPPer90: 0, exsvPercentage: 0, svPercentage: 0, ConPer90: 0,
});

const keeper = () => ({
  ...outfield(),
  goals90: 0, NPxGPer90: 0, ShTPer90: 0, ConvPercentage: 0, xGOP: 0, ShotsOutsideBoxPer90: 0,
  DrbPer90: 0, SprintsPer90: between(1, 5), PresAPer90: between(1, 6), PresCPer90: between(0, 2),
  Svt: int(20, 95), Svp: int(10, 60), Svh: int(15, 70),
  xGPPer90: between(0.6, 1.8), exsvPercentage: between(58, 82, 1),
  svPercentage: between(60, 84, 1), ConPer90: between(0.6, 2.1),
});

const players = [];
let uid = 1000;
for (const role of ROLES) {
  for (let i = 0; i < role.n; i++) {
    const lg = pick(LEAGUES);
    const starts = int(5, 34);
    players.push({
      UID: ++uid,
      Name: `${pick(FIRST)} ${pick(LAST)}`,
      Age: int(17, 35), Weight: int(62, 94), Height: int(166, 198),
      RcInjury: rnd() < 0.12,
      Nat: pick(NATS), Division: lg.league, Club: pick(lg.clubs),
      Wage: int(4, 85) * 1000,
      Expires: `new Date("20${int(26, 29)}-06-30")`,
      Position: role.pos,
      SecPosition: null,
      Starts: starts, Mins: starts * int(72, 90),
      ...(role.gk ? keeper() : outfield()),
    });
  }
}

const body = players.map((p) => {
  const entries = Object.entries(p).map(([k, v]) => {
    if (k === 'Expires') return `    ${k}: ${v}`;
    return `    ${k}: ${JSON.stringify(v)}`;
  });
  return `  {\n${entries.join(',\n')}\n  }`;
}).join(',\n');

const out = `// Generated fixture squad for design-sync previews - deterministic, do not hand-edit.
// Regenerate with the script referenced in .design-sync/NOTES.md.
export const leagueRankings = ${JSON.stringify(LEAGUES.map(({ rank, league }) => ({ rank, league })), null, 2)};

export const players = [
${body}
] as never[];
`;
writeFileSync('.design-sync/previews/_fixtures.ts', out);
console.log('players:', players.length, '| leagues:', LEAGUES.length);
