import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useSession } from "@/lib/auth";

const nav = [
  { to: "/", label: "Home" },
  { to: "/vehicles", label: "Vehicles" },
  { to: "/invest", label: "Invest" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { session } = useSession();
  const routerState = useRouterState();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {}, [routerState.location.pathname]);

  const loggedIn = !!session?.emailVerified;
  const accountHref = loggedIn ? "/portfolio" : "/auth";
  const accountLabel = loggedIn ? "Portfolio" : "Sign In";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-background/85 backdrop-blur-md border-b border-border" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6 lg:px-12">
        <Link to="/" className="text-lg font-semibold tracking-tight">OMNI-MUSK</Link>
        <nav className="hidden items-center gap-10 md:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
              activeProps={{ className: "text-sm font-semibold text-foreground" }}
              activeOptions={{ exact: n.to === "/" }}
            >
              {n.label}
            </Link>
          ))}
          {loggedIn && (
            <Link
              to="/portfolio"
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
              activeProps={{ className: "text-sm font-semibold text-foreground" }}
            >
              Portfolio
            </Link>
          )}
        </nav>
        <div className="hidden md:block">
          <Link
            to={accountHref}
            className="rounded-full bg-foreground px-5 py-2 text-xs font-semibold uppercase tracking-wider text-background transition-opacity hover:opacity-90"
          >
            {accountLabel}
          </Link>
        </div>
        <button className="md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="flex flex-col px-6 py-4">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="py-3 text-sm font-medium">
                {n.label}
              </Link>
            ))}
            <Link to={accountHref} onClick={() => setOpen(false)} className="py-3 text-sm font-semibold">
              {accountLabel}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
