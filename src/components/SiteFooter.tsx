import { Link } from "@tanstack/react-router";

const social = [
  { label: "X (Twitter)", href: "https://x.com/elonmusk" },
  { label: "Tesla", href: "https://x.com/Tesla" },
  { label: "SpaceX", href: "https://x.com/SpaceX" },
  { label: "Starlink", href: "https://x.com/Starlink" },
  { label: "Neuralink", href: "https://x.com/neuralink" },
  { label: "xAI", href: "https://x.com/xai" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-[1600px] px-6 py-16 lg:px-12">
        <div className="grid gap-12 md:grid-cols-4">
          <div>
            <div className="text-lg font-semibold tracking-tight">OMNI-MUSK</div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              A unified portal to acquire the world's most advanced vehicles and invest
              across the Muskonomy — from Tesla to xAI and beyond.
            </p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Explore
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link to="/" className="hover:underline">Home</Link></li>
              <li><Link to="/vehicles" className="hover:underline">Vehicles</Link></li>
              <li><Link to="/invest" className="hover:underline">Invest</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Official Channels
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {social.map((s) => (
                <li key={s.href}>
                  <a href={s.href} target="_blank" rel="noreferrer" className="hover:underline">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              About Omni-Musk
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Omni-Musk is a federally registered platform bringing institutional-grade
              access to next-generation transportation and capital. Our mission is to
              democratize ownership of the technologies that will define the next century.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              support@omni-musk.co · +1 (415) 555-0199
            </p>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <div>© {new Date().getFullYear()} Omni-Musk Holdings, Inc. All rights reserved.</div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Legal</a>
            <a href="#" className="hover:text-foreground">Risk Disclosure</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
