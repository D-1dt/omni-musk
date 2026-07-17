import { useSyncExternalStore } from "react";
import { subscribeMarket, getSnapshot, getPrice, getRangedHistory, type TimeRange } from "@/lib/market";

export function useMarketPrice(slug: string) {
  return useSyncExternalStore(
    subscribeMarket,
    () => getPrice(slug),
    () => getPrice(slug),
  );
}

export function useMarketSnapshot(slug: string) {
  return useSyncExternalStore(
    subscribeMarket,
    () => getSnapshot(slug),
    () => getSnapshot(slug),
  );
}

export function useMarketHistory(slug: string, range: TimeRange) {
  return useSyncExternalStore(
    subscribeMarket,
    () => getRangedHistory(slug, range),
    () => getRangedHistory(slug, range),
  );
}
