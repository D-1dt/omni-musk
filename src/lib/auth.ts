// Supabase-backed auth + session hook. Replaces the old localStorage store.
import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Session = {
  userId: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
};

let _session: Session | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function toSession(user: {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: { full_name?: string; name?: string };
} | null): Session | null {
  if (!user) return null;
  return {
    userId: user.id,
    email: user.email ?? "",
    fullName:
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) ||
      (user.email ?? "").split("@")[0],
    emailVerified: !!user.email_confirmed_at,
  };
}

let _initialized = false;
function ensureInit() {
  if (_initialized || typeof window === "undefined") return;
  _initialized = true;
  supabase.auth.getUser().then(({ data }) => {
    _session = toSession(data.user as never);
    notify();
  });
  supabase.auth.onAuthStateChange((_event, s) => {
    _session = toSession((s?.user as never) ?? null);
    notify();
  });
}

export function getSession(): Session | null {
  ensureInit();
  return _session;
}

export function useSession(): { session: Session | null; loading: boolean } {
  const [loading, setLoading] = useState(true);
  const session = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      ensureInit();
      return _session;
    },
    () => null,
  );
  useEffect(() => {
    let cancelled = false;
    ensureInit();
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      _session = toSession(data.user as never);
      notify();
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { session, loading };
}

// ---- Auth mutations ----
export async function signUp(fullName: string, email: string, password: string) {
  const { error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { full_name: fullName.trim() },
      emailRedirectTo: `${window.location.origin}/`,
    },
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function signOut() {
  await supabase.auth.signOut();
  _session = null;
  notify();
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function resendVerificationEmail(email: string) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: `${window.location.origin}/` },
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
