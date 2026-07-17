import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password · Omni-Musk" },
      { name: "description", content: "Choose a new password for your Omni-Musk account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Supabase parses the recovery hash on load and emits PASSWORD_RECOVERY.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Also check for existing session (link was already consumed once)
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    setDone(true);
    setTimeout(() => navigate({ to: "/portfolio" }), 1500);
  };

  return (
    <div className="mx-auto max-w-md px-6 py-24">
      <h1 className="text-3xl">Set a new password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose a strong password you haven't used before.
      </p>

      {!ready && !done && (
        <div className="mt-8 rounded-md border border-border bg-secondary p-4 text-sm text-muted-foreground">
          Waiting for the reset link to be recognized… If nothing happens, use the link from your
          email again.
        </div>
      )}

      {done ? (
        <div className="mt-8 rounded-md border border-emerald-300/40 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
          <CheckCircle2 className="mr-2 inline h-4 w-4" />
          Password updated. Redirecting to your portfolio…
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="text-muted-foreground">New password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              disabled={!ready}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Confirm password</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              required
              disabled={!ready}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
            />
          </label>
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={!ready || busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-xs font-semibold uppercase tracking-widest text-background disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Update Password
          </button>
        </form>
      )}

      <Link to="/auth" className="mt-8 inline-block text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
        ← Back to sign in
      </Link>
    </div>
  );
}
