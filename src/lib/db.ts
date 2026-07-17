// Async DB layer — Supabase-backed replacements for the old localStorage stores.
import { supabase } from "@/integrations/supabase/client";

// ---- Investments ----
export type PendingTransaction = {
  id: string;
  userId: string;
  kind: "investment" | "vehicle";
  label: string;
  entitySlug: string;
  entityName: string;
  tier?: string;
  amount: number;
  assetSymbol?: string;
  entryPrice?: number;
  createdAt: number;
  activationTime: number;
};

type InvestmentRow = {
  id: string;
  user_id: string;
  entity_slug: string;
  entity_name: string;
  tier: string;
  amount: number | string;
  asset_symbol: string | null;
  entry_price: number | string | null;
  activates_at: string;
  created_at: string;
};

function rowToInvestment(r: InvestmentRow): PendingTransaction {
  return {
    id: r.id,
    userId: r.user_id,
    kind: "investment",
    label: `${r.entity_name} · ${r.tier}`,
    entitySlug: r.entity_slug,
    entityName: r.entity_name,
    tier: r.tier,
    amount: Number(r.amount),
    assetSymbol: r.asset_symbol ?? undefined,
    entryPrice: r.entry_price != null ? Number(r.entry_price) : undefined,
    createdAt: new Date(r.created_at).getTime(),
    activationTime: new Date(r.activates_at).getTime(),
  };
}

export async function listInvestments(userId: string): Promise<PendingTransaction[]> {
  const { data, error } = await supabase
    .from("investments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as InvestmentRow[]).map(rowToInvestment);
}

export async function addInvestment(input: {
  userId: string;
  entitySlug: string;
  entityName: string;
  tier: string;
  amount: number;
  assetSymbol?: string;
  entryPrice?: number;
  txHash?: string;
  receiptName?: string;
}): Promise<PendingTransaction | null> {
  const now = new Date();
  const activates = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from("investments")
    .insert({
      user_id: input.userId,
      entity_slug: input.entitySlug,
      entity_name: input.entityName,
      tier: input.tier,
      amount: input.amount,
      asset_symbol: input.assetSymbol,
      entry_price: input.entryPrice,
      tx_hash: input.txHash,
      receipt_name: input.receiptName,
      activates_at: activates.toISOString(),
      status: "verifying",
    } as never)
    .select("*")
    .single();
  if (error) {
    console.error(error);
    return null;
  }
  return rowToInvestment(data as InvestmentRow);
}

export function isActive(tx: PendingTransaction) {
  return Date.now() >= tx.activationTime;
}

// ---- Vehicle Orders ----
export type DeliveryDetails = {
  fullName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
};

export type VehicleOrderStatus = "verifying" | "action_required" | "processing_delivery";

export type VehicleOrder = {
  id: string;
  userId: string;
  slug: string;
  vehicleName: string;
  colorName: string;
  colorIndex: number;
  wheelIndex: number;
  interiorIndex: number;
  down: number;
  total: number;
  term: number;
  apr: number;
  createdAt: number;
  verificationTime: number;
  status: VehicleOrderStatus;
  delivery?: DeliveryDetails;
  receiptName?: string;
  txHash?: string;
};

type VehicleOrderRow = {
  id: string;
  user_id: string;
  slug: string;
  vehicle_name: string;
  color_name: string;
  color_index: number;
  wheel_index: number;
  interior_index: number;
  down: number | string;
  total: number | string;
  term: number;
  apr: number | string;
  verification_time: string;
  status: VehicleOrderStatus;
  delivery: DeliveryDetails | null;
  receipt_name: string | null;
  tx_hash: string | null;
  created_at: string;
};

function rowToOrder(r: VehicleOrderRow): VehicleOrder {
  return {
    id: r.id,
    userId: r.user_id,
    slug: r.slug,
    vehicleName: r.vehicle_name,
    colorName: r.color_name,
    colorIndex: r.color_index,
    wheelIndex: r.wheel_index,
    interiorIndex: r.interior_index,
    down: Number(r.down),
    total: Number(r.total),
    term: r.term,
    apr: Number(r.apr),
    createdAt: new Date(r.created_at).getTime(),
    verificationTime: new Date(r.verification_time).getTime(),
    status: r.status,
    delivery: r.delivery ?? undefined,
    receiptName: r.receipt_name ?? undefined,
    txHash: r.tx_hash ?? undefined,
  };
}

export async function listVehicleOrders(userId: string): Promise<VehicleOrder[]> {
  const { data, error } = await supabase
    .from("vehicle_orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as VehicleOrderRow[]).map(rowToOrder);
}

export async function getVehicleOrder(id: string): Promise<VehicleOrder | null> {
  const { data, error } = await supabase.from("vehicle_orders").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return rowToOrder(data as VehicleOrderRow);
}

export async function addVehicleOrder(input: {
  userId: string;
  slug: string;
  vehicleName: string;
  colorName: string;
  colorIndex: number;
  wheelIndex: number;
  interiorIndex: number;
  down: number;
  total: number;
  term: number;
  apr: number;
  receiptName?: string;
  txHash?: string;
}): Promise<VehicleOrder | null> {
  const now = new Date();
  const verify = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from("vehicle_orders")
    .insert({
      user_id: input.userId,
      slug: input.slug,
      vehicle_name: input.vehicleName,
      color_name: input.colorName,
      color_index: input.colorIndex,
      wheel_index: input.wheelIndex,
      interior_index: input.interiorIndex,
      down: input.down,
      total: input.total,
      term: input.term,
      apr: input.apr,
      receipt_name: input.receiptName,
      tx_hash: input.txHash,
      verification_time: verify.toISOString(),
      status: "verifying",
    })
    .select("*")
    .single();
  if (error) {
    console.error(error);
    return null;
  }
  return rowToOrder(data as VehicleOrderRow);
}

export async function updateVehicleOrder(
  id: string,
  patch: { delivery?: DeliveryDetails; status?: VehicleOrderStatus },
): Promise<VehicleOrder | null> {
  const { data, error } = await supabase
    .from("vehicle_orders")
    // deliberately cast: DeliveryDetails serialises cleanly into the jsonb column
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return null;
  return rowToOrder(data as VehicleOrderRow);
}

export function deriveVehicleOrderStatus(o: VehicleOrder): VehicleOrderStatus {
  if (o.status === "processing_delivery") return "processing_delivery";
  if (Date.now() >= o.verificationTime) return "action_required";
  return "verifying";
}
