import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { detectIoc, idForNav, IOC_LABELS, type IocType } from "@/lib/detect";
import { ConsoleHeader, ConsoleFooter, KindBadge } from "@/components/secur/ui";
import { CyberBackground } from "@/components/secur/CyberBackground";
import { FileUploadScanner } from "@/components/secur/FileUploadScanner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SecurOSINT — Threat Intelligence Console" },
      {
        name: "description",
        content:
          "SecurOSINT scans file hashes, URLs, domains and IP addresses across 70+ security vendors to surface malware, phishing and malicious infrastructure.",
      },
      { property: "og:title", content: "SecurOSINT — Threat Intelligence Console" },
      {
        property: "og:description",
        content: "Scan files, URLs, domains and IPs across 70+ security vendors in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

interface RecentScan {
  type: IocType;
  id: string;
  raw: string;
  at: number;
}

const SAMPLES: { label: string; type: IocType; value: string }[] = [
  { label: "google.com", type: "domain", value: "google.com" },
  { label: "8.8.8.8", type: "ip", value: "8.8.8.8" },
  { label: "EICAR test hash", type: "file", value: "44d88612fea8a8f36de82e1278abb02f" },
  { label: "example.com", type: "url", value: "https://example.com/" },
];

function readRecent(): RecentScan[] {
  try {
    const raw = localStorage.getItem("secur-osint.recent");
    return raw ? (JSON.parse(raw) as RecentScan[]).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function Index() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"file" | "search">("file");
  const [value, setValue] = useState("");
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setRecent(readRecent()), []);

  const detected = detectIoc(value);

  const go = (raw: string, overrideType?: IocType, customLabel?: string) => {
    const type = overrideType || detectIoc(raw);
    if (!type) return;
    const id = idForNav(type, raw);
    setScanning(true);
    const entry: RecentScan = {
      type,
      id,
      raw: (customLabel || raw).trim(),
      at: Date.now(),
    };
    setRecent((prev) => {
      const next = [entry, ...prev.filter((p) => p.id !== id || p.type !== type)].slice(0, 8);
      try {
        localStorage.setItem("secur-osint.recent", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    setTimeout(() => {
      navigate({ to: "/report/$type/$id", params: { type, id } });
    }, 450);
  };

  const handleFileUploadScan = (hash: string, fileName: string) => {
    const entry: RecentScan = {
      type: "file",
      id: hash,
      raw: `${fileName} (${hash.slice(0, 8)}...)`,
      at: Date.now(),
    };
    setRecent((prev) => {
      const next = [entry, ...prev.filter((p) => p.id !== hash || p.type !== "file")].slice(0, 8);
      try {
        localStorage.setItem("secur-osint.recent", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground selection:bg-primary/30">
      {/* Sci-Fi Cybersecurity Animated Background */}
      <CyberBackground />

      <ConsoleHeader />

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-24">
        {/* Hero Section */}
        <section className="flex flex-col items-center pt-16 pb-8 text-center sm:pt-24">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 shadow-[0_0_20px_rgba(6,182,212,0.15)] animate-fade-up">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
            <span className="label-tactical text-primary">Live Multi-Vendor Threat Grid</span>
          </div>

          <h1 className="max-w-3xl font-display text-5xl font-bold leading-[1.04] tracking-tight sm:text-6xl animate-fade-up">
            <span className="text-metal">SCAN EVERYTHING.</span>
            <br />
            <span className="text-cyan-glow">TRUST NOTHING.</span>
          </h1>

          <p className="mt-5 max-w-xl text-balance text-muted-foreground animate-fade-up">
            Cryptographic file hash verification, malware detection, domain reputation, and infrastructure reconnaissance across 70+ security vendors.
          </p>

          {/* Interactive Mode Switcher Tabs */}
          <div className="mt-10 flex w-full max-w-md items-center justify-center rounded-xl border border-white/10 bg-black/40 p-1.5 backdrop-blur-md animate-fade-up">
            <button
              onClick={() => setActiveTab("file")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 font-mono text-xs font-semibold uppercase tracking-wider transition-all duration-200",
                activeTab === "file"
                  ? "bg-primary text-black shadow-[0_0_20px_rgba(6,182,212,0.5)] font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5",
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload File Scan
            </button>
            <button
              onClick={() => setActiveTab("search")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 font-mono text-xs font-semibold uppercase tracking-wider transition-all duration-200",
                activeTab === "search"
                  ? "bg-primary text-black shadow-[0_0_20px_rgba(6,182,212,0.5)] font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5",
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              URL / IP / Hash Search
            </button>
          </div>

          {/* Tab 1: File Upload Scanner */}
          {activeTab === "file" && (
            <div className="mt-6 w-full max-w-2xl animate-fade-up">
              <FileUploadScanner onScanStart={handleFileUploadScan} />
            </div>
          )}

          {/* Tab 2: Search Input Form */}
          {activeTab === "search" && (
            <form
              className="relative mt-6 w-full max-w-2xl animate-fade-up"
              onSubmit={(e) => {
                e.preventDefault();
                if (detected) go(value);
              }}
            >
              <div className="panel-metal texture-brush relative flex items-center gap-2 rounded-2xl p-2 pl-4 border border-white/15">
                {scanning && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                    <div className="absolute inset-y-0 w-1/3 animate-scan-sweep bg-[linear-gradient(90deg,transparent,oklch(0.84_0.135_195/0.25),transparent)]" />
                  </div>
                )}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 text-primary">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Paste a file hash, URL, domain or IP address…"
                  spellCheck={false}
                  className="min-w-0 flex-1 bg-transparent py-3 font-mono text-[0.95rem] text-foreground outline-none placeholder:text-muted-foreground/70"
                />
                {detected && (
                  <span className="hidden sm:inline-flex shrink-0 items-center rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[0.65rem] font-semibold tracking-wider text-primary">
                    {IOC_LABELS[detected]}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={!detected}
                  className={cn(
                    "shrink-0 rounded-xl px-6 py-3 font-display text-sm font-bold uppercase tracking-wider transition-all",
                    detected ? "button-cta shadow-[0_0_20px_rgba(6,182,212,0.4)]" : "button-metal cursor-not-allowed opacity-45",
                  )}
                >
                  Scan
                </button>
              </div>
              {value && !detected && (
                <div className="mt-2 text-center font-mono text-xs text-warning/90">
                  Unrecognized indicator — expected a hash, URL, domain or IP address.
                </div>
              )}
            </form>
          )}

          {/* Quick Indicator Samples */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 animate-fade-up">
            <span className="label-tactical mr-1">Quick Query:</span>
            {SAMPLES.map((s) => (
              <button
                key={s.value}
                onClick={() => {
                  setActiveTab("search");
                  go(s.value);
                }}
                className="button-metal rounded-lg px-3.5 py-2 font-mono text-xs text-foreground/85 hover:border-primary/40 transition-all"
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        {/* Live Ticker */}
        <div className="relative overflow-hidden border-y border-white/8 py-3 bg-black/30 backdrop-blur-sm">
          <div className="flex w-max animate-marquee gap-10 font-mono text-[0.7rem] uppercase tracking-[0.3em] text-muted-foreground">
            {Array.from({ length: 2 }).map((_, dup) => (
              <span key={dup} className="flex gap-10">
                {[
                  "In-browser SHA-256 computation",
                  "VirusTotal Intelligence Feed",
                  "Static File Analysis",
                  "Domain Reputation",
                  "IP Infrastructure Recon",
                  "URL Phishing Scanner",
                  "70+ Vendor Security Engines",
                  "DNS & Whois Intelligence",
                ].map((t) => (
                  <span key={t} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rotate-45 bg-primary shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                    {t}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* Capabilities Grid */}
        <section className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "File Checksum",
              desc: "Upload files directly to calculate SHA-256 and query threat verdicts instantly.",
              k: "file" as IocType,
              tab: "file" as const,
            },
            {
              title: "Domain Recon",
              desc: "Registrar history, DNS records, categories and vendor-flagged reputation.",
              k: "domain" as IocType,
              tab: "search" as const,
            },
            {
              title: "IP Intelligence",
              desc: "ASN ownership, geolocation, network range and abuse signals.",
              k: "ip" as IocType,
              tab: "search" as const,
            },
            {
              title: "URL Scanner",
              desc: "Phishing and malware detection with final redirect resolution.",
              k: "url" as IocType,
              tab: "search" as const,
            },
          ].map((c) => (
            <button
              key={c.title}
              onClick={() => {
                setActiveTab(c.tab);
                if (c.tab === "search") inputRef.current?.focus();
              }}
              className="panel-metal texture-brush group rounded-xl p-5 text-left transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]"
            >
              <KindBadge type={c.k} />
              <div className="mt-3 font-display text-lg font-semibold">{c.title}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
            </button>
          ))}
        </section>

        {/* Recent Scans */}
        {recent.length > 0 && (
          <section className="mt-14">
            <div className="flex items-center justify-between mb-3">
              <div className="label-tactical">Recent Scans & Uploads</div>
              <button
                onClick={() => {
                  localStorage.removeItem("secur-osint.recent");
                  setRecent([]);
                }}
                className="font-mono text-[0.65rem] text-muted-foreground hover:text-destructive uppercase tracking-wider"
              >
                Clear History
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {recent.map((r) => (
                <button
                  key={`${r.type}:${r.id}`}
                  onClick={() => navigate({ to: "/report/$type/$id", params: { type: r.type, id: r.id } })}
                  className="panel-metal flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-all hover:border-primary/40 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                >
                  <KindBadge type={r.type} />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/85">{r.raw}</span>
                  <span className="shrink-0 font-mono text-[0.65rem] text-muted-foreground">
                    {new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <ConsoleFooter />
    </div>
  );
}
