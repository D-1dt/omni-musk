import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  listInvestments,
  listVehicleOrders,
  isActive,
  deriveVehicleOrderStatus,
  type PendingTransaction,
  type VehicleOrder,
} from "@/lib/db";
import { signOut, useSession } from "@/lib/auth";
import { useMarketPrice, useMarketSnapshot } from "@/hooks/useMarketData";
import { assetBySlug, getPrice, subscribeMarket } from "@/lib/market";
import { getEntity } from "@/lib/data";
import { MarketChartModal } from "@/components/MarketChartModal";
import { AlertCircle, CheckCircle2, Clock, LineChart, LogOut, TrendingDown, TrendingUp, Truck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({
    meta: [
      { title: "My Portfolio · Omni-Musk" },
      { name: "description", content: "Track your Omni-Musk allocations, live market valuation, and active vehicle orders." },
    ],
  }),
  component: PortfolioPage,
});

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function currency2(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function useCountdown(target: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(target - now, 0);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return { ms, label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` };
}

function PortfolioPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [txs, setTxs] = useState<PendingTransaction[]>([]);
  const [orders, setOrders] = useState<VehicleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"investments" | "vehicles">("investments");
  const [openChart, setOpenChart] = useState<PendingTransaction | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const [t, o] = await Promise.all([
          listInvestments(session.userId),
          listVehicleOrders(session.userId),
        ]);
        if (cancelled) return;
        setTxs(t);
        setOrders(o);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!session || loading) {
    return <div className="mx-auto max-w-xl px-6 py-32 text-center text-white/70">Loading…</div>;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const chartEntity = openChart ? getEntity(openChart.entitySlug) : null;

  return (
    <div className="relative min-h-screen bg-[#05060a] text-white">
      {/* Ambient neon backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 10%, rgba(59,130,246,0.18), transparent 45%), radial-gradient(circle at 85% 15%, rgba(236,72,153,0.14), transparent 45%), radial-gradient(circle at 50% 100%, rgba(34,197,94,0.10), transparent 45%)",
        }}
      />
      <div className="relative mx-auto max-w-[1400px] px-6 py-12 lg:px-12 lg:py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">My Portfolio</div>
            <h1 className="mt-2 text-4xl md:text-5xl">Welcome, {session.fullName.split(" ")[0]}.</h1>
            <p className="mt-2 text-sm text-white/60">{session.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/80 backdrop-blur hover:bg-white/10 sm:self-auto"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>

        <PortfolioMetrics txs={txs} orders={orders} />

        <div className="mt-12 inline-flex rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
          <TabBtn active={tab === "investments"} onClick={() => setTab("investments")}>Market Allocations</TabBtn>
          <TabBtn active={tab === "vehicles"} onClick={() => setTab("vehicles")}>Vehicle Orders</TabBtn>
        </div>

        {tab === "investments" && (
          <div className="mt-6 grid gap-4">
            {txs.length === 0 ? (
              <EmptyCard
                title="No positions yet."
                subtitle="Select an investment tier and click Verify Payment to open your first allocation."
              />
            ) : (
              txs.map((t) => (
                <InvestmentCard key={t.id} tx={t} onOpenChart={() => setOpenChart(t)} />
              ))
            )}
          </div>
        )}

        {tab === "vehicles" && (
          <div className="mt-6 grid gap-4">
            {orders.length === 0 ? (
              <EmptyCard
                title="No vehicle orders yet."
                subtitle="Configure a vehicle and submit a payment receipt to start tracking here."
              />
            ) : (
              orders.map((o) => <VehicleOrderCard key={o.id} order={o} />)
            )}
          </div>
        )}
      </div>

      {openChart && chartEntity && (
        <MarketChartModal
          entity={chartEntity}
          entryPrice={openChart.entryPrice}
          onClose={() => setOpenChart(null)}
        />
      )}
    </div>
  );
}

function PortfolioMetrics({ txs, orders }: { txs: PendingTransaction[]; orders: VehicleOrder[] }) {
  // Force a re-render on every market tick so aggregate value stays live.
  const [, setTick] = useState(0);
  useEffect(() => subscribeMarket(() => setTick((n) => n + 1)), []);

  const active = txs.filter(isActive);
  const pending = txs.filter((t) => !isActive(t));

  let totalCurrent = 0;
  let totalInitial = 0;
  for (const t of active) {
    totalInitial += t.amount;
    const p = getPrice(t.entitySlug);
    if (t.entryPrice && p) totalCurrent += (p / t.entryPrice) * t.amount;
    else totalCurrent += t.amount;
  }
  const pl = totalCurrent - totalInitial;
  const plPct = totalInitial > 0 ? (pl / totalInitial) * 100 : 0;
  const up = pl >= 0;

  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <GlassMetric label="Portfolio Value" value={currency2(totalCurrent)}>
        {totalInitial > 0 && (
          <span
            className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{
              backgroundColor: up ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
              color: up ? "#4ade80" : "#f87171",
            }}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {up ? "+" : ""}{plPct.toFixed(2)}%
          </span>
        )}
      </GlassMetric>
      <GlassMetric label="Total Invested" value={currency(totalInitial)} hint="Cost basis" />
      <GlassMetric label="Pending Verifications" value={String(pending.length)} hint="Awaiting 2h window" />
      <GlassMetric label="Vehicle Orders" value={String(orders.length)} hint="Across all builds" />
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
        active ? "bg-white text-black" : "text-white/60 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function GlassMetric({ label, value, hint, children }: { label: string; value: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
      <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/50">{label}</div>
      <div className="mt-3 text-3xl font-medium">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
        {hint}
        {children}
      </div>
    </div>
  );
}

function EmptyCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-20 text-center backdrop-blur">
      <p className="text-sm text-white/70">{title}</p>
      <p className="mt-1 text-xs text-white/50">{subtitle}</p>
    </div>
  );
}

function InvestmentCard({ tx, onOpenChart }: { tx: PendingTransaction; onOpenChart: () => void }) {
  const active = isActive(tx);
  const { label } = useCountdown(tx.activationTime);
  const price = useMarketPrice(tx.entitySlug);
  const snap = useMarketSnapshot(tx.entitySlug);
  const asset = assetBySlug(tx.entitySlug);
  const accent = asset?.color ?? "#3b82f6";

  const current = tx.entryPrice && price ? (price / tx.entryPrice) * tx.amount : tx.amount;
  const pl = current - tx.amount;
  const plPct = (pl / tx.amount) * 100;
  const up = pl >= 0;

  const dayChange = snap ? snap.current - snap.open24h : 0;
  const dayPct = snap ? (dayChange / snap.open24h) * 100 : 0;
  const dayUp = dayChange >= 0;

  return (
    <button
      onClick={active ? onOpenChart : undefined}
      disabled={!active}
      className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-90"
      style={{
        boxShadow: active ? `inset 0 0 0 1px ${accent}22` : undefined,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-30 blur-3xl"
        style={{ backgroundColor: accent }}
      />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold text-white"
            style={{ backgroundColor: accent }}
          >
            {tx.entityName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/50">
              {asset?.symbol ?? "—"} · {tx.tier}
            </div>
            <h3 className="mt-1 text-xl font-medium">{tx.entityName}</h3>
            <p className="text-xs text-white/50">
              Entry {tx.entryPrice ? `$${tx.entryPrice.toFixed(2)}` : "—"} · Invested {currency(tx.amount)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 md:flex md:items-center md:gap-10">
          <div className="md:text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/50">Live Price</div>
            <div className="mt-1 text-lg font-medium">{price ? `$${price.toFixed(2)}` : "—"}</div>
            {snap && (
              <div
                className="text-xs font-semibold"
                style={{ color: dayUp ? "#4ade80" : "#f87171" }}
              >
                {dayUp ? "+" : ""}{dayPct.toFixed(2)}% 24h
              </div>
            )}
          </div>
          <div className="md:text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/50">Current Value</div>
            <div className="mt-1 text-lg font-medium">{currency2(current)}</div>
            <div
              className="inline-flex items-center gap-1 text-xs font-semibold"
              style={{ color: up ? "#4ade80" : "#f87171" }}
            >
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {up ? "+" : ""}{plPct.toFixed(2)}%
            </div>
          </div>

          <div className="col-span-2 md:col-auto md:text-right">
            {active ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                <LineChart className="h-3.5 w-3.5" /> View chart
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300">
                <Clock className="h-3.5 w-3.5" /> Pending · {label}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function VehicleOrderCard({ order }: { order: VehicleOrder }) {
  const navigate = useNavigate();
  const status = deriveVehicleOrderStatus(order);
  const { label } = useCountdown(order.verificationTime);
  const submitted = new Date(order.createdAt).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const goToCheckout = () =>
    navigate({
      to: "/checkout",
      search: {
        slug: order.slug,
        color: order.colorIndex,
        wheel: order.wheelIndex,
        interior: order.interiorIndex,
        down: order.down,
        term: order.term,
        apr: order.apr,
        orderId: order.id,
      },
    });

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/50">
              Vehicle Order · {submitted}
            </div>
            <h3 className="mt-1 text-xl font-medium">{order.vehicleName}</h3>
            <p className="text-sm text-white/60">
              {order.colorName} · Down {currency(order.down)} · Total {currency(order.total)}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 md:items-end">
          {status === "verifying" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-300">
              <Clock className="h-3.5 w-3.5" /> Verifying Payment · {label}
            </span>
          )}
          {status === "action_required" && (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-300">
                <AlertCircle className="h-3.5 w-3.5" /> Action Required: Enter Delivery Details
              </span>
              <button
                onClick={goToCheckout}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-widest text-black"
              >
                Enter Delivery Details
              </button>
            </>
          )}
          {status === "processing_delivery" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Processing for Delivery
            </span>
          )}
        </div>
      </div>

      {order.delivery && (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/50">Delivery to</div>
          <div className="mt-1 font-medium">{order.delivery.fullName}</div>
          <div className="text-white/60">
            {order.delivery.street}, {order.delivery.city}, {order.delivery.state} {order.delivery.zip} · {order.delivery.phone}
          </div>
        </div>
      )}
    </div>
  );
}
