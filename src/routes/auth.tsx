import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  requestPasswordReset,
  resendVerificationEmail,
  signIn,
  signUp,
  useSession,
} from "@/lib/auth";
import { lovable } from "@/integrations/lovable";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";

type Search = { verify?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    verify: s.verify ? String(s.verify) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign In · Omni-Musk" },
      { name: "description", content: "Sign in or create your Omni-Musk account to access your investment portfolio." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { verify } = Route.useSearch();
  const { session, loading } = useSession();

  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null);

  // If verified user lands here, bounce to portfolio.
  useEffect(() => {
    if (!loading && session?.emailVerified && !verify) {
      navigate({ to: "/portfolio" });
    }
  }, [session, loading, navigate, verify]);

  // If logged in but unverified (or ?verify=1), show verification pending screen
  const unverified = (session && !session.emailVerified) || !!verify;
  if (unverified) {
    return <VerifyEmailPending email={session?.email ?? pendingVerifyEmail ?? ""} />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const r = await signUp(fullName, email, password);
        if (!r.ok) return setError(r.error);
        setPendingVerifyEmail(email);
        setNotice("Account created. Check your inbox to verify your email.");
      } else if (mode === "signin") {
        const r = await signIn(email, password);
        if (!r.ok) return setError(r.error);
        // Session change effect will redirect
      } else if (mode === "forgot") {
        const r = await requestPasswordReset(email);
        if (!r.ok) return setError(r.error);
        setNotice("If an account exists for this email, we've sent a reset link.");
      }
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) setError(result.error.message ?? "Google sign-in failed.");
      // If redirected, browser takes over. Otherwise session listener redirects.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1400px] gap-0 px-6 py-12 lg:grid-cols-2 lg:px-12">
      <div className="hidden flex-col justify-between rounded-l-3xl bg-foreground p-12 text-background lg:flex">
        <div className="text-lg font-semibold tracking-tight">OMNI-MUSK</div>
        <div>
          <h1 className="text-4xl leading-tight md:text-5xl">
            The future of transportation and capital.
          </h1>
          <p className="mt-4 max-w-md text-background/70">
            Sign in to track your allocations, verify pending transactions, and
            monitor active positions across Tesla and Musk-venture plans.
          </p>
        </div>
        <div className="text-xs uppercase tracking-widest text-background/50">
          Private investor portal
        </div>
      </div>

      <div className="flex flex-col justify-center rounded-r-3xl border border-border bg-card p-8 md:p-12">
        <div className="inline-flex self-start rounded-full border border-border bg-secondary p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
                setNotice(null);
              }}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
                mode === m ? "bg-foreground text-background" : "text-muted-foreground"
              }`}
            >
              {m === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <h2 className="mt-8 text-3xl">
          {mode === "signin"
            ? "Welcome back."
            : mode === "signup"
            ? "Create your account."
            : "Reset your password."}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Access your Omni-Musk portfolio."
            : mode === "signup"
            ? "We'll email you a verification link to activate your account."
            : "Enter your email and we'll send you a reset link."}
        </p>

        {/* Google */}
        <button
          onClick={google}
          disabled={busy}
          className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background py-3 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <label className="block text-sm">
              <span className="text-muted-foreground">Full name</span>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="text-muted-foreground">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
            />
          </label>
          {mode !== "forgot" && (
            <label className="block text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Password</span>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                      setNotice(null);
                    }}
                    className="text-xs font-medium text-foreground/80 hover:underline"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
              />
            </label>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-md border border-emerald-300/40 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {notice}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-xs font-semibold uppercase tracking-widest text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {mode === "signin" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
          </button>
        </form>

        <p className="mt-6 text-xs text-muted-foreground">
          {mode === "forgot" ? (
            <>
              Remembered it?{" "}
              <button onClick={() => setMode("signin")} className="font-semibold text-foreground underline-offset-4 hover:underline">
                Back to sign in
              </button>
            </>
          ) : mode === "signin" ? (
            <>
              New to Omni-Musk?{" "}
              <button onClick={() => setMode("signup")} className="font-semibold text-foreground underline-offset-4 hover:underline">
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button onClick={() => setMode("signin")} className="font-semibold text-foreground underline-offset-4 hover:underline">
                Sign in
              </button>
            </>
          )}
        </p>

        <Link to="/" className="mt-8 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

function VerifyEmailPending({ email }: { email: string }) {
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session?.emailVerified) navigate({ to: "/portfolio" });
  }, [session, navigate]);

  const resend = async () => {
    if (!email || busy) return;
    setBusy(true);
    setError(null);
    const r = await resendVerificationEmail(email);
    setBusy(false);
    if (!r.ok) setError(r.error);
    else setResent(true);
  };

  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
        <Mail className="h-6 w-6" />
      </div>
      <h1 className="mt-6 text-3xl">Verify your email</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        We sent a confirmation link to <span className="font-medium text-foreground">{email || "your inbox"}</span>.
        Open it to activate your account, then return here to access your portfolio.
      </p>
      {error && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>
      )}
      <button
        onClick={resend}
        disabled={busy || resent}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-background disabled:opacity-60"
      >
        {resent ? <><CheckCircle2 className="h-3.5 w-3.5" /> Sent</> : busy ? "Sending…" : "Resend verification email"}
      </button>
      <div className="mt-6">
        <Link to="/" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1a6.98 6.98 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
