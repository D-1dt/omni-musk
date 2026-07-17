import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, Loader2, ShieldCheck, X } from "lucide-react";
import { getVehicle, wallets, cryptoRails } from "@/lib/data";
import {
  addVehicleOrder,
  deriveVehicleOrderStatus,
  getVehicleOrder,
  listVehicleOrders,
  updateVehicleOrder,
  type DeliveryDetails,
  type VehicleOrder,
} from "@/lib/db";
import { getSession } from "@/lib/auth";

type CheckoutSearch = {
  slug: string;
  color: number;
  wheel: number;
  interior: number;
  down: number;
  term: number;
  apr: number;
  orderId?: string;
};

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => ({
    slug: String(search.slug ?? "model-s"),
    color: Number(search.color ?? 0),
    wheel: Number(search.wheel ?? 0),
    interior: Number(search.interior ?? 0),
    down: Number(search.down ?? 10000),
    term: Number(search.term ?? 60),
    apr: Number(search.apr ?? 5.99),
    orderId: search.orderId ? String(search.orderId) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Checkout — Omni-Musk" },
      { name: "description", content: "Complete your Tesla order with crypto: BTC, ETH, SOL or XRP." },
    ],
  }),
  component: CheckoutPage,
});

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function CheckoutPage() {
  const search = Route.useSearch();
  const vehicle = getVehicle(search.slug);
  const navigate = useNavigate();

  if (!vehicle) {
    return (
      <div className="mx-auto max-w-xl px-6 py-32 text-center">
        <h1 className="text-3xl">Vehicle not found</h1>
        <Link to="/vehicles" className="mt-6 inline-block text-sm underline">Back to showroom</Link>
      </div>
    );
  }

  const color = vehicle.colors[search.color] ?? vehicle.colors[0];
  const wheel = vehicle.wheels[search.wheel] ?? vehicle.wheels[0];
  const interior = vehicle.interiors[search.interior] ?? vehicle.interiors[0];

  const total = vehicle.basePrice + color.price + wheel.price + interior.price;
  const monthly = useMemo(() => {
    const principal = Math.max(total - search.down, 0);
    const r = search.apr / 100 / 12;
    if (r === 0) return principal / search.term;
    return (principal * r) / (1 - Math.pow(1 + r, -search.term));
  }, [total, search.down, search.apr, search.term]);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-12 lg:px-12 lg:py-16">
      <button
        onClick={() => navigate({ to: "/vehicles" })}
        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Configurator
      </button>

      <div className="mt-6 max-w-3xl">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Vehicle Checkout</div>
        <h1 className="mt-3 text-4xl md:text-5xl">Confirm your {vehicle.name}.</h1>
        <p className="mt-3 text-muted-foreground">
          Review your build, fund in crypto, and submit your receipt to lock the order.
        </p>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        {/* Order Summary */}
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="rounded-xl bg-secondary p-6">
            <img
              key={color.image}
              src={color.image}
              alt={`${vehicle.name} in ${color.name}`}
              className="mx-auto w-full max-w-xl object-contain animate-fade-up"
            />
          </div>

          <div className="mt-8">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Order summary</div>
            <h2 className="mt-1 text-2xl font-medium">{vehicle.name}</h2>

            <dl className="mt-6 divide-y divide-border text-sm">
              {[
                { k: "Paint", v: color.name, p: color.price },
                { k: "Wheels", v: wheel.name, p: wheel.price },
                { k: "Interior", v: interior.name, p: interior.price },
                { k: "Base price", v: vehicle.name, p: vehicle.basePrice },
              ].map((row) => (
                <div key={row.k} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">{row.k}</div>
                    <div className="font-medium">{row.v}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {row.p === 0 ? "Included" : `+ ${currency(row.p)}`}
                  </div>
                </div>
              ))}
            </dl>

            <div className="mt-6 rounded-xl bg-foreground p-5 text-background">
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-widest text-background/70">Total</span>
                <span className="text-2xl font-medium">{currency(total)}</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between border-t border-background/15 pt-3">
                <span className="text-xs uppercase tracking-widest text-background/70">
                  {search.term} mo · {search.apr.toFixed(2)}% APR · {currency(search.down)} down
                </span>
                <span className="text-lg font-medium">{currency(monthly)}<span className="text-xs text-background/70"> /mo</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment / State Machine */}
        <div>
          <CheckoutFlow
            search={search}
            vehicleName={vehicle.name}
            colorName={color.name}
            total={total}
          />
        </div>
      </div>
    </div>
  );
}

// -------- State machine --------

type Phase = "await_receipt" | "verifying" | "action_required" | "processing_delivery";

function CheckoutFlow({
  search,
  vehicleName,
  colorName,
  total,
}: {
  search: CheckoutSearch;
  vehicleName: string;
  colorName: string;
  total: number;
}) {
  const navigate = useNavigate();
  const [order, setOrder] = useState<VehicleOrder | null>(null);
  const [phase, setPhase] = useState<Phase>("await_receipt");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const tickRef = useRef<number | null>(null);

  // Resume: hydrate from database on mount
  useEffect(() => {
    setHydrated(true);
    const session = getSession();
    if (!session) return;

    (async () => {
      let found: VehicleOrder | null = null;
      if (search.orderId) {
        found = await getVehicleOrder(search.orderId);
      }
      if (!found) {
        const open = (await listVehicleOrders(session.userId))
          .filter((o) => o.slug === search.slug && o.status !== "processing_delivery")
          .sort((a: VehicleOrder, b: VehicleOrder) => b.createdAt - a.createdAt);
        found = open[0] ?? null;
      }
      if (found) {
        setOrder(found);
        setPhase(deriveVehicleOrderStatus(found) as Phase);
      }
    })();
  }, [search.orderId, search.slug]);

  // Tick every second while verifying to flip → action_required at verificationTime
  useEffect(() => {
    if (phase !== "verifying" || !order) return;
    tickRef.current = window.setInterval(() => {
      if (Date.now() >= order.verificationTime) {
        setPhase("action_required");
        if (tickRef.current) window.clearInterval(tickRef.current);
      }
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [phase, order]);

  const handleReceiptSubmit = async (data: { receiptName?: string; txHash?: string }) => {
    const session = getSession();
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    const created = await addVehicleOrder({
      userId: session.userId,
      slug: search.slug,
      vehicleName,
      colorName,
      colorIndex: search.color,
      wheelIndex: search.wheel,
      interiorIndex: search.interior,
      down: search.down,
      total,
      term: search.term,
      apr: search.apr,
      receiptName: data.receiptName,
      txHash: data.txHash,
    });
    if (!created) return;
    setOrder(created);
    setPhase("verifying");
  };

  const handleDeliverySubmit = async (delivery: DeliveryDetails) => {
    if (!order) return;
    const updated = await updateVehicleOrder(order.id, { delivery, status: "processing_delivery" });
    if (updated) {
      setOrder(updated);
      setPhase("processing_delivery");
      setShowSuccessModal(true);
    }
  };

  if (!hydrated) {
    return <PanelShell>Loading…</PanelShell>;
  }

  return (
    <>
      {phase === "await_receipt" && (
        <PaymentPanel
          total={total}
          down={search.down}
          vehicleName={vehicleName}
          colorName={colorName}
          onSubmitted={handleReceiptSubmit}
          onRequireAuth={() => navigate({ to: "/auth" })}
        />
      )}

      {phase === "verifying" && order && (
        <VerifyingPanel order={order} />
      )}

      {phase === "action_required" && order && (
        <DeliveryFormPanel order={order} onSubmit={handleDeliverySubmit} />
      )}

      {phase === "processing_delivery" && order && (
        <ProcessingPanel order={order} onView={() => navigate({ to: "/portfolio" })} />
      )}

      {showSuccessModal && (
        <SuccessModal onClose={() => setShowSuccessModal(false)} onView={() => navigate({ to: "/portfolio" })} />
      )}
    </>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">{children}</div>
  );
}

function PaymentPanel({
  total,
  down,
  vehicleName,
  colorName,
  onSubmitted,
  onRequireAuth,
}: {
  total: number;
  down: number;
  vehicleName: string;
  colorName: string;
  onSubmitted: (data: { receiptName?: string; txHash?: string }) => void;
  onRequireAuth: () => void;
}) {
  const [active, setActive] = useState<(typeof cryptoRails)[number]["key"]>("BTC");
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const address = wallets[active];

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Crypto payment</div>
      <h2 className="mt-1 text-2xl font-medium">Fund {currency(total)}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose your rail and send the equivalent of the total. Use only the matching asset.
      </p>

      <div className="mt-5 rounded-xl border border-border bg-secondary p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Down payment to wallet</div>
            <div className="mt-1 text-2xl font-medium">{currency(down)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Remaining</div>
            <div className="mt-1 text-sm font-medium text-muted-foreground">{currency(Math.max(total - down, 0))}</div>
          </div>
        </div>
      </div>

      <div className="mt-6 inline-flex rounded-full border border-border bg-secondary p-1">
        {cryptoRails.map((c) => (
          <button
            key={c.key}
            onClick={() => setActive(c.key)}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
              active === c.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.ticker}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-border bg-secondary p-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {cryptoRails.find((c) => c.key === active)!.label} wallet address
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <code className="truncate font-mono text-sm">{address}</code>
          <button
            onClick={copy}
            aria-label="Copy address"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-foreground/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors hover:bg-foreground hover:text-background"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <p className="mt-6 text-sm font-semibold">
        Once payment has been made click the button below to verify payment and submit details.
      </p>

      <button
        onClick={() => {
          if (!getSession()) return onRequireAuth();
          setOpen(true);
        }}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold uppercase tracking-widest text-white shadow-sm transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--success)" }}
      >
        <ShieldCheck className="h-4 w-4" />
        Verify Payment
      </button>

      {open && (
        <ReceiptModal
          onClose={() => setOpen(false)}
          vehicleName={vehicleName}
          colorName={colorName}
          amount={down}
          onSubmit={(d) => {
            setOpen(false);
            onSubmitted(d);
          }}
        />
      )}
    </div>
  );
}

function ReceiptModal({
  onClose,
  vehicleName,
  colorName,
  amount,
  onSubmit,
}: {
  onClose: () => void;
  vehicleName: string;
  colorName: string;
  amount: number;
  onSubmit: (data: { receiptName?: string; txHash?: string }) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 animate-fade-up" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg rounded-2xl bg-background p-8 shadow-[var(--shadow-elevated)]">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {vehicleName} · {colorName} · {currency(amount)} down
        </div>
        <h3 className="mt-1 text-2xl">Verify your transaction.</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload your transaction hash, screenshot, or PDF receipt. Verification takes up to 2 hours; you can track progress in your Portfolio.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ receiptName: file?.name, txHash: hash || undefined });
          }}
          className="mt-6 space-y-4"
        >
          <label className="block text-sm">
            <span className="text-muted-foreground">Transaction hash / reference</span>
            <input
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Receipt (image or PDF)</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-widest file:text-background"
            />
            {file && <div className="mt-1 text-xs text-muted-foreground">Attached: {file.name}</div>}
          </label>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold uppercase tracking-widest text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--success)" }}
          >
            <ShieldCheck className="h-4 w-4" />
            Submit for Verification
          </button>
        </form>
      </div>
    </div>
  );
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
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function VerifyingPanel({ order }: { order: VehicleOrder }) {
  const label = useCountdown(order.verificationTime);
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
        <Loader2 className="h-6 w-6 animate-spin text-foreground" />
      </div>
      <div className="mt-5 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Verifying payment</div>
      <h3 className="mt-2 text-2xl">Confirming your transaction…</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        We're validating your receipt on-chain. This typically completes within 2 hours. You can close this page — we'll pick up where you left off.
      </p>
      <div className="mt-6 inline-flex items-baseline gap-2 rounded-full border border-border bg-secondary px-5 py-2 font-mono text-lg">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">ETA</span>
        {label}
      </div>
      <div className="mt-6 text-xs text-muted-foreground">
        Order ID · <span className="font-mono">{order.id}</span>
      </div>
    </div>
  );
}

function DeliveryFormPanel({ order, onSubmit }: { order: VehicleOrder; onSubmit: (d: DeliveryDetails) => void }) {
  const [d, setD] = useState<DeliveryDetails>({
    fullName: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
  });
  const update = (k: keyof DeliveryDetails) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setD((prev: DeliveryDetails) => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <div className="flex items-center gap-2 rounded-full bg-[var(--success)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--success)" }}>
        <Check className="h-3.5 w-3.5" /> Payment Successful
      </div>
      <h2 className="mt-4 text-2xl font-medium">Delivery Details</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Where should we deliver your {order.vehicleName} ({order.colorName})?
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(d);
        }}
        className="mt-6 space-y-4"
      >
        <Field label="Full Name" value={d.fullName} onChange={update("fullName")} required />
        <Field label="Street Address" value={d.street} onChange={update("street")} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="City" value={d.city} onChange={update("city")} required />
          <Field label="State / Province" value={d.state} onChange={update("state")} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ZIP / Postal Code" value={d.zip} onChange={update("zip")} required />
          <Field label="Phone Number" value={d.phone} onChange={update("phone")} required type="tel" />
        </div>
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-sm font-semibold uppercase tracking-widest text-background transition-opacity hover:opacity-90"
        >
          Submit Delivery Details
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={onChange}
        required={required}
        type={type}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}

function ProcessingPanel({ order, onView }: { order: VehicleOrder; onView: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: "var(--success)" }}>
        <Check className="h-7 w-7 text-white" />
      </div>
      <h3 className="mt-5 text-2xl">Processing for delivery</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Your {order.vehicleName} is being prepared. We'll email you with a delivery window shortly.
      </p>
      <button
        onClick={onView}
        className="mt-6 rounded-full bg-foreground px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-background"
      >
        View Portfolio
      </button>
    </div>
  );
}

function SuccessModal({ onClose, onView }: { onClose: () => void; onView: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 animate-fade-up" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-2xl bg-background p-8 text-center shadow-[var(--shadow-elevated)]">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: "var(--success)" }}>
          <Check className="h-7 w-7 text-white" />
        </div>
        <h3 className="mt-5 text-2xl">Information Submitted.</h3>
        <p className="mt-3 text-sm text-muted-foreground">
          Please hold while we get your car ready, you'll be notified via email regarding when it'll be delivered.
        </p>
        <button
          onClick={onView}
          className="mt-6 w-full rounded-full bg-foreground py-3 text-xs font-semibold uppercase tracking-widest text-background"
        >
          Track in Portfolio
        </button>
      </div>
    </div>
  );
}
