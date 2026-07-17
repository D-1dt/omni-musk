// Simulated live market feed. A single global store tick-updates prices for
// every Musk-venture asset and stashes a rolling history so the chart modal
// can render 1D/1W/1M/3M/1Y views without additional data plumbing.

export type AssetMeta = {
  slug: string;
  symbol: string;
  name: string;
  color: string;
  base: number; // seed price
};

export const ASSETS: AssetMeta[] = [
  { slug: "tesla", symbol: "TSLA", name: "Tesla", color: "#E31937", base: 248.5 },
  { slug: "spacex", symbol: "SPCX", name: "SpaceX", color: "#4F8BFF", base: 412.8 },
  { slug: "neuralink", symbol: "NLNK", name: "Neuralink", color: "#B983FF", base: 87.4 },
  { slug: "the-boring-company", symbol: "TBC", name: "The Boring Company", color: "#F59E0B", base: 54.2 },
  { slug: "xai", symbol: "XAI", name: "xAI", color: "#22D3EE", base: 132.9 },
  { slug: "starlink", symbol: "STLK", name: "Starlink", color: "#1A73E8", base: 198.6 },
  { slug: "x", symbol: "X", name: "X", color: "#FFFFFF", base: 74.3 },
  { slug: "solarcity", symbol: "SCTY", name: "SolarCity", color: "#F5A623", base: 41.8 },
  { slug: "openai-legacy", symbol: "OAI", name: "OpenAI Legacy Stake", color: "#10A37F", base: 305.1 },
  { slug: "zip2", symbol: "ZIP2", name: "Zip2 Holdings", color: "#9CA3AF", base: 28.7 },
  { slug: "paypal-mafia", symbol: "PYPL", name: "X.com / PayPal Legacy", color: "#3B82F6", base: 62.4 },
  { slug: "hyperloop", symbol: "HYPR", name: "Hyperloop Initiative", color: "#EC4899", base: 39.9 },
];

export const assetBySlug = (slug: string) => ASSETS.find((a) => a.slug === slug);

export type PricePoint = { t: number; p: number };

type SnapshotState = Record<
  string,
  { current: number; open24h: number; high24h: number; low24h: number; volume: number; history: PricePoint[] }
>;

const TICK_MS = 6000;
const HISTORY_POINTS = 260; // ≈ enough resolution for 1D/1W views on top of coarse seeded data

// Seed a plausible-looking historical series for a slug going back ~1 year.
function seedHistory(base: number): PricePoint[] {
  const now = Date.now();
  const year = 365 * 24 * 60 * 60 * 1000;
  const points: PricePoint[] = [];
  let price = base * 0.72;
  // Use a deterministic-ish walk seeded from `base` so charts stay stable across reloads.
  let seed = Math.floor(base * 1000) % 9973;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const step = year / HISTORY_POINTS;
  for (let i = 0; i < HISTORY_POINTS; i++) {
    const drift = (base - price) * 0.008; // pull toward base
    const shock = (rand() - 0.5) * base * 0.045;
    price = Math.max(base * 0.35, price + drift + shock);
    points.push({ t: now - (HISTORY_POINTS - i) * step, p: +price.toFixed(2) });
  }
  points.push({ t: now, p: +base.toFixed(2) });
  return points;
}

const state: SnapshotState = {};
for (const a of ASSETS) {
  const history = seedHistory(a.base);
  const current = history[history.length - 1].p;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const last24 = history.filter((h) => h.t >= cutoff);
  state[a.slug] = {
    current,
    open24h: last24[0]?.p ?? current,
    high24h: Math.max(...last24.map((h) => h.p), current),
    low24h: Math.min(...last24.map((h) => h.p), current),
    volume: Math.round(a.base * 42_000 + Math.random() * 250_000),
    history,
  };
}

type Listener = () => void;
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;
let version = 0;

// Cache derived values so useSyncExternalStore sees stable references
// between ticks (otherwise a new filtered array every render = infinite loop).
const snapshotCache = new Map<string, { v: number; value: SnapshotState[string] }>();
const historyCache = new Map<string, { v: number; value: PricePoint[] }>();

function tick() {
  const now = Date.now();
  for (const a of ASSETS) {
    const s = state[a.slug];
    const drift = (a.base - s.current) * 0.01;
    const shock = (Math.random() - 0.5) * a.base * 0.012;
    s.current = Math.max(a.base * 0.35, +(s.current + drift + shock).toFixed(2));
    s.high24h = Math.max(s.high24h, s.current);
    s.low24h = Math.min(s.low24h, s.current);
    s.volume += Math.round(Math.random() * 4200);
    s.history.push({ t: now, p: s.current });
    if (s.history.length > HISTORY_POINTS + 400) s.history.splice(0, s.history.length - (HISTORY_POINTS + 400));
  }
  version++;
  listeners.forEach((l) => l());
}

function ensureTimer() {
  if (typeof window === "undefined") return;
  if (timer) return;
  timer = setInterval(tick, TICK_MS);
}

export function subscribeMarket(listener: Listener): () => void {
  ensureTimer();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function getSnapshot(slug: string) {
  const s = state[slug];
  if (!s) return s;
  const cached = snapshotCache.get(slug);
  if (cached && cached.v === version) return cached.value;
  const value = { ...s };
  snapshotCache.set(slug, { v: version, value });
  return value;
}

export function getPrice(slug: string): number | undefined {
  return state[slug]?.current;
}

export type TimeRange = "1D" | "1W" | "1M" | "3M" | "1Y";
const rangeMs: Record<TimeRange, number> = {
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "3M": 90 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
};

export function getRangedHistory(slug: string, range: TimeRange): PricePoint[] {
  const s = state[slug];
  if (!s) return [];
  const key = `${slug}:${range}`;
  const cached = historyCache.get(key);
  if (cached && cached.v === version) return cached.value;
  const cutoff = Date.now() - rangeMs[range];
  const value = s.history.filter((h) => h.t >= cutoff);
  historyCache.set(key, { v: version, value });
  return value;
}

