// Curated metro-area clusters for airports that sit in the same self-transfer
// market. Keys are IATA-style city codes — labels only, never validated
// against anything. `icaos` are the airports bundled into each cluster.
//
// Curation rules:
// - Standard metro areas with several commercial airports, plus famous
//   low-cost adjuncts (BGY, BVA, HHN). Fringe fields merely ticketed as the
//   city (NRN Weeze, FMM Memmingen, NYO/VST Stockholm) are left out.
// - Deliberately excluded: single-airport cities (Berlin, Munich,
//   Düsseldorf); Rhine-Ruhr, which stays separate so Cologne and Dortmund
//   cannot chain into one mega-cluster; Basel (one ICAO, several IATA codes);
//   cross-city pairs such as Copenhagen–Malmö and Bratislava–Vienna.
export type MetroArea = { name: string; icaos: readonly string[] };

/** Airport clusters keyed by IATA-style city code. */
export const METRO_AREAS = {
  // Girona adjunct (90 km).
  BCN: { name: 'Barcelona', icaos: ['LEBL', 'LEGE'] },
  BFS: { name: 'Belfast', icaos: ['EGAA', 'EGAC'] },
  BJS: { name: 'Beijing', icaos: ['ZBAA', 'ZBAD'] },
  BKK: { name: 'Bangkok', icaos: ['VTBD', 'VTBS'] },
  // Charleroi adjunct (45 km).
  BRU: { name: 'Brussels', icaos: ['EBBR', 'EBCI'] },
  BUE: { name: 'Buenos Aires', icaos: ['SABE', 'SAEZ'] },
  CHI: { name: 'Chicago', icaos: ['KMDW', 'KORD'] },
  CTU: { name: 'Chengdu', icaos: ['ZUTF', 'ZUUU'] },
  DFW: { name: 'Dallas', icaos: ['KDAL', 'KDFW'] },
  DXB: { name: 'Dubai', icaos: ['OMDB', 'OMDW'] },
  // HHN (Hahn) included per curation (105 km).
  FRA: { name: 'Frankfurt', icaos: ['EDDF', 'EDFH'] },
  // Prestwick adjunct (46 km).
  GLA: { name: 'Glasgow', icaos: ['EGPF', 'EGPK'] },
  // A region rather than a metro area, but both airports serve one market.
  GOI: { name: 'Goa', icaos: ['VOGA', 'VOGO'] },
  HOU: { name: 'Houston', icaos: ['KHOU', 'KIAH'] },
  // LTBA has closed to passengers.
  IST: { name: 'Istanbul', icaos: ['LTFJ', 'LTFM'] },
  // Lanseria adjunct.
  JNB: { name: 'Johannesburg', icaos: ['FALA', 'FAOR'] },
  // ONT excluded (Inland Empire).
  LAX: { name: 'Los Angeles', icaos: ['KBUR', 'KLAX', 'KSNA'] },
  LON: {
    name: 'London',
    icaos: ['EGGW', 'EGKK', 'EGLC', 'EGLL', 'EGMC', 'EGSS'],
  },
  // MMSM = NLU Felipe Ángeles.
  MEX: { name: 'Mexico City', icaos: ['MMMX', 'MMSM'] },
  // Same urban corridor; KPBI excluded.
  MIA: { name: 'Miami', icaos: ['KFLL', 'KMIA'] },
  // BGY (Bergamo) included per curation.
  MIL: { name: 'Milan', icaos: ['LIMC', 'LIME', 'LIML'] },
  MOW: { name: 'Moscow', icaos: ['UUDD', 'UUEE', 'UUWW'] },
  // HPN and SWF excluded.
  NYC: { name: 'New York', icaos: ['KEWR', 'KJFK', 'KLGA'] },
  // KIX, Itami and Kobe.
  OSA: { name: 'Osaka', icaos: ['RJBB', 'RJBE', 'RJOO'] },
  // Torp (110 km), commonly ticketed as Oslo.
  OSL: { name: 'Oslo', icaos: ['ENGM', 'ENTO'] },
  // BVA (Beauvais) included per curation (85 km).
  PAR: { name: 'Paris', icaos: ['LFOB', 'LFPG', 'LFPO'] },
  // KEF ↔ RKV self-transfer is common.
  REK: { name: 'Reykjavík', icaos: ['BIKF', 'BIRK'] },
  RIO: { name: 'Rio de Janeiro', icaos: ['SBGL', 'SBRJ'] },
  ROM: { name: 'Rome', icaos: ['LIRA', 'LIRF'] },
  // VCP (Campinas, 90 km); IATA itself groups these under SAO.
  SAO: { name: 'São Paulo', icaos: ['SBGR', 'SBKP', 'SBSP'] },
  SEL: { name: 'Seoul', icaos: ['RKSI', 'RKSS'] },
  SFO: { name: 'SF Bay', icaos: ['KOAK', 'KSFO', 'KSJC'] },
  SHA: { name: 'Shanghai', icaos: ['ZSPD', 'ZSSS'] },
  // NYO and VST excluded per curation.
  STO: { name: 'Stockholm', icaos: ['ESSA', 'ESSB'] },
  THR: { name: 'Tehran', icaos: ['OIIE', 'OIII'] },
  TPE: { name: 'Taipei', icaos: ['RCSS', 'RCTP'] },
  // Ibaraki excluded.
  TYO: { name: 'Tokyo', icaos: ['RJAA', 'RJTT'] },
  // Treviso adjunct (30 km).
  VCE: { name: 'Venice', icaos: ['LIPH', 'LIPZ'] },
  // BWI accepted as DC-area.
  WAS: { name: 'Washington', icaos: ['KBWI', 'KDCA', 'KIAD'] },
  // EPMO = Modlin (EPLB is Lublin, a different city).
  WAW: { name: 'Warsaw', icaos: ['EPMO', 'EPWA'] },
  YTO: { name: 'Toronto', icaos: ['CYTZ', 'CYYZ'] },
} as const satisfies Record<string, MetroArea>;

export type MetroAreaCode = keyof typeof METRO_AREAS;
