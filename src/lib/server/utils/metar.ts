import type {
  CloudLayer,
  FlightCategory,
  ParsedMetar,
} from '$lib/zod/metar';

const TTL_MS = 10 * 60 * 1000;
const STALE_FALLBACK_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const METAR_API = 'https://aviationweather.gov/api/data/metar';

type CacheEntry = {
  value: ParsedMetar | null;
  fetchedAt: number;
  expiresAt: number;
};
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<ParsedMetar | null>>();

type AwcMetar = {
  rawOb?: string;
  obsTime?: number;
  icaoId?: string;
};

export async function getParsedMetar(
  icao: string,
): Promise<ParsedMetar | null> {
  const key = icao.toUpperCase();
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const fetched = await fetchMetar(key);
      const parsed = fetched
        ? parseMetar(fetched.raw, fetched.observedAtIso)
        : null;
      cache.set(key, {
        value: parsed,
        fetchedAt: now,
        expiresAt: now + TTL_MS,
      });
      return parsed;
    } catch (err) {
      console.error(`[metar] fetch/parse failed for ${key}:`, err);
      if (cached && now - cached.fetchedAt < STALE_FALLBACK_MS) {
        return cached.value;
      }
      cache.set(key, {
        value: null,
        fetchedAt: now,
        expiresAt: now + 60_000,
      });
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

async function fetchMetar(
  icao: string,
): Promise<{ raw: string; observedAtIso: string } | null> {
  const url = `${METAR_API}?ids=${encodeURIComponent(icao)}&format=json&hours=3`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`METAR fetch ${resp.status} ${resp.statusText}`);
    }
    const data = (await resp.json()) as AwcMetar[];
    if (!Array.isArray(data) || data.length === 0) return null;
    // API returns newest first, but be defensive.
    const latest = [...data]
      .filter((d) => typeof d.rawOb === 'string' && d.rawOb.length > 0)
      .sort((a, b) => (b.obsTime ?? 0) - (a.obsTime ?? 0))[0];
    if (!latest?.rawOb) return null;
    const obsTime = latest.obsTime
      ? new Date(latest.obsTime * 1000).toISOString()
      : new Date().toISOString();
    return { raw: latest.rawOb, observedAtIso: obsTime };
  } finally {
    clearTimeout(timer);
  }
}

const COVERAGE_VALUES = ['SKC', 'FEW', 'SCT', 'BKN', 'OVC'] as const;
// Auto-observers append `///` when a field couldn't be determined
// (e.g. `FEW140///` = altitude known, cloud type unknown).
const CLOUD_RE =
  /^(SKC|CLR|NCD|NSC|FEW|SCT|BKN|OVC|\/{3})(\d{3}|\/{3})?(CB|TCU|\/{3})?$/;
const VV_RE = /^VV(\d{3})$/;
const WIND_RE = /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS|KMH)$/;
const VAR_WIND_RE = /^(\d{3})V(\d{3})$/;
const TIMESTAMP_RE = /^(\d{2})(\d{2})(\d{2})Z$/;
const TEMP_DEW_RE = /^(M?\d{2}|\/\/)\/(M?\d{2}|\/\/)$/;
const ALTIMETER_RE = /^([AQ])(\d{4})$/;
const VIS_METERS_RE = /^(\d{4})(NDV|N|NE|E|SE|S|SW|W|NW)?$/;
const VIS_SM_RE = /^M?(\d+(?:\/\d+)?)SM$/;
const RVR_RE = /^R\d{2}[LRC]?\//;
const WX_PHENOM_RE =
  /^(\+|-|VC)?((MI|BC|PR|DR|BL|SH|TS|FZ){1,2})?(DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)+$/;

export function parseMetar(
  raw: string,
  observedAtIsoFromApi?: string,
): ParsedMetar | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 3) return null;

  // Drop everything from RMK onward — remarks aren't parsed.
  const rmkIdx = tokens.indexOf('RMK');
  const main = rmkIdx >= 0 ? tokens.slice(0, rmkIdx) : tokens.slice();

  // Drop trend section (NOSIG / BECMG / TEMPO ...).
  const trendIdx = main.findIndex(
    (t) => t === 'NOSIG' || t === 'BECMG' || t === 'TEMPO',
  );
  const body = trendIdx >= 0 ? main.slice(0, trendIdx) : main;

  if (body[0] === 'METAR' || body[0] === 'SPECI') body.shift();

  const station = body.shift();
  if (!station || !/^[A-Z][A-Z0-9]{3}$/.test(station)) return null;

  let observedAtIso: string;
  if (body[0] && TIMESTAMP_RE.test(body[0])) {
    const m = body.shift()!.match(TIMESTAMP_RE)!;
    observedAtIso =
      observedAtIsoFromApi ??
      resolveTimestamp(parseInt(m[1]), parseInt(m[2]), parseInt(m[3]));
  } else if (observedAtIsoFromApi) {
    observedAtIso = observedAtIsoFromApi;
  } else {
    return null;
  }

  while (body[0] === 'AUTO' || body[0] === 'COR') body.shift();

  const wind = parseWind(body);

  let visibilityM = 9999;
  let cavok = false;
  if (body[0] === 'CAVOK') {
    body.shift();
    cavok = true;
  } else {
    const vis = parseVisibility(body);
    if (vis !== null) visibilityM = vis;
  }

  while (body[0] && RVR_RE.test(body[0])) body.shift();

  while (body[0] && WX_PHENOM_RE.test(body[0])) body.shift();

  const { clouds, verticalVisibilityFt } = parseClouds(body);

  let tempC: number | null = null;
  let dewpointC: number | null = null;
  if (body[0]) {
    const td = body[0].match(TEMP_DEW_RE);
    if (td) {
      body.shift();
      tempC = parseTempPart(td[1]);
      dewpointC = parseTempPart(td[2]);
    }
  }

  let pressureHpa: number | null = null;
  for (const tok of body) {
    const am = tok.match(ALTIMETER_RE);
    if (am) {
      const v = parseInt(am[2]);
      pressureHpa = am[1] === 'Q' ? v : Math.round((v / 100) * 33.8639);
      break;
    }
  }

  clouds.sort((a, b) => a.baseFt - b.baseFt);

  const flightCategory = computeFlightCategory({
    visibilityM,
    clouds,
    verticalVisibilityFt,
    cavok,
  });

  return {
    raw: trimmed,
    station,
    observedAtIso,
    wind,
    visibilityM,
    cavok,
    clouds,
    verticalVisibilityFt,
    tempC,
    dewpointC,
    pressureHpa,
    flightCategory,
  };
}

function parseWind(body: string[]): ParsedMetar['wind'] {
  const wind: ParsedMetar['wind'] = {
    dirDeg: null,
    speedKt: 0,
    gustKt: null,
    varies: null,
  };
  if (!body[0]) return wind;
  const wm = body[0].match(WIND_RE);
  if (!wm) return wind;
  body.shift();
  const dir = wm[1] === 'VRB' ? null : parseInt(wm[1]);
  let speed = parseInt(wm[2]);
  let gust = wm[3] ? parseInt(wm[3]) : null;
  const unit = wm[4];
  if (unit === 'MPS') {
    speed = Math.round(speed * 1.94384);
    if (gust !== null) gust = Math.round(gust * 1.94384);
  } else if (unit === 'KMH') {
    speed = Math.round(speed * 0.539957);
    if (gust !== null) gust = Math.round(gust * 0.539957);
  }
  wind.dirDeg = dir;
  wind.speedKt = speed;
  wind.gustKt = gust;

  if (body[0]) {
    const vm = body[0].match(VAR_WIND_RE);
    if (vm) {
      body.shift();
      wind.varies = { from: parseInt(vm[1]), to: parseInt(vm[2]) };
    }
  }
  return wind;
}

function parseVisibility(body: string[]): number | null {
  if (!body[0]) return null;
  // Statute miles can come as "N" (whole) + "n/dSM" (fraction)
  if (
    /^\d+$/.test(body[0]) &&
    body[1] &&
    /^M?\d+\/\d+SM$/.test(body[1])
  ) {
    const whole = parseInt(body.shift()!);
    const fracTok = body.shift()!.replace(/^M/, '').replace(/SM$/, '');
    const [num, den] = fracTok.split('/').map(Number);
    return Math.round((whole + num / den) * 1609.344);
  }
  const sm = body[0].match(VIS_SM_RE);
  if (sm) {
    body.shift();
    const part = sm[1];
    let value: number;
    if (part.includes('/')) {
      const [num, den] = part.split('/').map(Number);
      value = num / den;
    } else {
      value = parseFloat(part);
    }
    return Math.round(value * 1609.344);
  }
  const mm = body[0].match(VIS_METERS_RE);
  if (mm) {
    body.shift();
    while (body[0] && /^\d{4}(N|NE|E|SE|S|SW|W|NW)$/.test(body[0])) {
      body.shift();
    }
    return parseInt(mm[1]);
  }
  return null;
}

function parseClouds(body: string[]): {
  clouds: CloudLayer[];
  verticalVisibilityFt: number | null;
} {
  const clouds: CloudLayer[] = [];
  let verticalVisibilityFt: number | null = null;
  while (body[0]) {
    const t = body[0];
    const cm = t.match(CLOUD_RE);
    if (cm) {
      body.shift();
      const cov = cm[1];
      if (cov === 'CLR' || cov === 'NCD' || cov === 'NSC' || cov === 'SKC') {
        continue;
      }
      if (!cm[2] || cm[2] === '///') continue;
      if (!(COVERAGE_VALUES as readonly string[]).includes(cov)) continue;
      const base = parseInt(cm[2]) * 100;
      const mod = cm[3] === 'CB' || cm[3] === 'TCU' ? cm[3] : null;
      clouds.push({
        coverage: cov as CloudLayer['coverage'],
        baseFt: base,
        modifier: mod,
      });
      continue;
    }
    const vv = t.match(VV_RE);
    if (vv) {
      body.shift();
      verticalVisibilityFt = parseInt(vv[1]) * 100;
      continue;
    }
    break;
  }
  return { clouds, verticalVisibilityFt };
}

function parseTempPart(p: string): number | null {
  if (p === '//') return null;
  const neg = p.startsWith('M');
  const n = parseInt(neg ? p.slice(1) : p);
  if (Number.isNaN(n)) return null;
  return neg ? -n : n;
}

function resolveTimestamp(
  day: number,
  hour: number,
  minute: number,
): string {
  const now = new Date();
  const guess = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hour, minute, 0, 0),
  );
  const diffH = (guess.getTime() - now.getTime()) / 3_600_000;
  if (diffH > 200) guess.setUTCMonth(guess.getUTCMonth() - 1);
  else if (diffH < -200) guess.setUTCMonth(guess.getUTCMonth() + 1);
  return guess.toISOString();
}

function computeFlightCategory(args: {
  visibilityM: number;
  clouds: CloudLayer[];
  verticalVisibilityFt: number | null;
  cavok: boolean;
}): FlightCategory {
  if (args.cavok) return 'VFR';
  const visSM = args.visibilityM / 1609.344;
  const ceilingFt =
    args.verticalVisibilityFt ??
    args.clouds.find((c) => c.coverage === 'BKN' || c.coverage === 'OVC')
      ?.baseFt ??
    99_999;
  if (visSM < 1 || ceilingFt < 500) return 'LIFR';
  if (visSM < 3 || ceilingFt < 1000) return 'IFR';
  if (visSM <= 5 || ceilingFt <= 3000) return 'MVFR';
  return 'VFR';
}
