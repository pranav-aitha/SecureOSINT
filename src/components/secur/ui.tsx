import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { formatBytes, IOC_LABELS, type IocType } from "@/lib/detect";
import type { VtReport, DnsRecord } from "@/lib/vt.server";

/* ---------------- Logo ---------------- */

export function Logo({ compact = false }: { compact?: boolean }) {
  const base = import.meta.env.BASE_URL || "/";
  return (
    <div className="flex items-center gap-3 select-none">
      <div className="relative flex items-center justify-center">
        <img
          src={`${base}logo.png`}
          alt="SecurOSINT Logo"
          className="h-9 w-9 object-contain drop-shadow-[0_0_12px_rgba(6,182,212,0.65)]"
        />
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="font-display text-[1.35rem] font-bold tracking-tight text-metal">
            Secur<span className="text-cyan-glow">OSINT</span>
          </div>
          <div className="label-tactical mt-1 text-[0.55rem]">Threat Intelligence Console</div>
        </div>
      )}
    </div>
  );
}

export function ConsoleHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-glow" />
            <span className="label-tactical">Feed Online</span>
          </span>
        </div>
      </div>
    </header>
  );
}

/* ---------------- Verdict helpers ---------------- */

export type Verdict = "malicious" | "suspicious" | "clean" | "unknown";

export function verdictOf(r: VtReport): Verdict {
  const s = r.stats;
  if (!s) return "unknown";
  if (s.malicious > 0) return "malicious";
  if (s.suspicious > 0) return "suspicious";
  return "clean";
}

export const VERDICT_META: Record<Verdict, { label: string; cls: string; dot: string }> = {
  malicious: { label: "Malicious", cls: "text-destructive", dot: "bg-destructive" },
  suspicious: { label: "Suspicious", cls: "text-warning", dot: "bg-warning" },
  clean: { label: "Clean", cls: "text-success", dot: "bg-success" },
  unknown: { label: "No Analyses", cls: "text-muted-foreground", dot: "bg-muted-foreground" },
};

/* ---------------- Count-up ---------------- */

function useCountUp(target: number, duration = 850) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

/* ---------------- Verdict dial ---------------- */

export function VerdictDial({ report }: { report: VtReport }) {
  const [mounted, setMounted] = useState(false);
  const verdict = verdictOf(report);
  const meta = VERDICT_META[verdict];
  const s = report.stats ?? { harmless: 0, malicious: 0, suspicious: 0, undetected: 0, timeout: 0 };
  const total = Math.max(1, s.harmless + s.malicious + s.suspicious + s.undetected + s.timeout);
  const malFrac = s.malicious / total;
  const susFrac = s.suspicious / total;

  const R = 52;
  const C = 2 * Math.PI * R;
  const malLen = malFrac * C;
  const susLen = susFrac * C;

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const detected = useCountUp(s.malicious + s.suspicious);

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" stroke="oklch(1 0 0 / 7%)" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={R} fill="none"
            stroke="oklch(0.63 0.24 27)" strokeWidth="10" strokeLinecap="butt"
            strokeDasharray={`${malLen} ${C}`}
            style={{ strokeDashoffset: mounted ? 0 : C, transition: "stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)" }}
          />
          <circle
            cx="60" cy="60" r={R} fill="none"
            stroke="oklch(0.83 0.15 85)" strokeWidth="10" strokeLinecap="butt"
            strokeDasharray={`${susLen} ${C}`}
            strokeDashoffset={-malLen}
            style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.9s ease 0.35s" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-display text-3xl font-bold tabular-nums", meta.cls)}>{detected}</span>
          <span className="label-tactical text-[0.55rem]">/ {total} vendors</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot, "animate-pulse-glow")} />
          <span className={cn("font-display text-2xl font-bold tracking-tight uppercase", meta.cls)}>
            {meta.label}
          </span>
        </div>
        {report.threatLabel && (
          <div className="mt-1.5 font-mono text-sm text-muted-foreground">{report.threatLabel}</div>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <KindBadge type={report.kind} />
          {report.tags?.slice(0, 6).map((t) => (
            <span key={t} className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[0.68rem] text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function KindBadge({ type }: { type: IocType }) {
  return (
    <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[0.68rem] font-semibold text-primary">
      {IOC_LABELS[type]}
    </span>
  );
}

/* ---------------- Stat cards ---------------- */

export function StatCard({ label, value, tone }: { label: string; value: number; tone: "danger" | "warn" | "ok" | "muted" }) {
  const v = useCountUp(value);
  const toneCls = {
    danger: "text-destructive",
    warn: "text-warning",
    ok: "text-success",
    muted: "text-foreground",
  }[tone];
  return (
    <div className="panel-metal texture-brush rounded-xl p-4 animate-fade-up">
      <div className="label-tactical">{label}</div>
      <div className={cn("mt-1.5 font-display text-3xl font-bold tabular-nums", toneCls)}>{v}</div>
    </div>
  );
}

/* ---------------- Engines table ---------------- */

const ENGINE_FILTERS = ["all", "malicious", "suspicious", "harmless", "undetected"] as const;

export function EnginesTable({ engines }: { engines: NonNullable<VtReport["engines"]> }) {
  const [filter, setFilter] = useState<(typeof ENGINE_FILTERS)[number]>("all");
  const [q, setQ] = useState("");

  const rows = useMemo(
    () =>
      engines.filter(
        (e) =>
          (filter === "all" || e.category === filter) &&
          (!q || e.engine.toLowerCase().includes(q.toLowerCase())),
      ),
    [engines, filter, q],
  );

  const catCls: Record<string, string> = {
    malicious: "text-destructive border-destructive/40 bg-destructive/10",
    suspicious: "text-warning border-warning/40 bg-warning/10",
    harmless: "text-success border-success/30 bg-success/10",
    undetected: "text-muted-foreground border-white/10 bg-white/5",
  };

  return (
    <div className="panel-metal texture-brush rounded-xl overflow-hidden animate-fade-up">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/8 p-3">
        <div className="mr-auto flex flex-wrap gap-1.5">
          {ENGINE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-3 py-1.5 font-mono text-[0.68rem] uppercase tracking-wider transition-all",
                filter === f
                  ? "bg-primary/15 text-primary border border-primary/40 shadow-[0_0_16px_-4px] shadow-primary/40"
                  : "border border-white/8 bg-white/4 text-muted-foreground hover:bg-white/8 hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="filter vendors…"
          className="w-44 rounded-md border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/40"
        />
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {rows.length === 0 ? (
          <div className="p-6 text-center font-mono text-sm text-muted-foreground">No vendors match.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {rows.map((e) => (
                <tr key={e.engine} className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/4">
                  <td className="px-4 py-2.5 font-medium">{e.engine}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground max-w-[16rem] truncate">
                    {e.result ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={cn("inline-block rounded-md border px-2 py-0.5 font-mono text-[0.65rem] uppercase", catCls[e.category] ?? catCls["undetected"])}>
                      {e.category}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ---------------- Details ---------------- */

const COPYABLE = new Set(["SHA-256", "SHA-1", "MD5", "URL", "Final URL"]);

export function DetailPanel({ report }: { report: VtReport }) {
  const d = report.details ?? {};
  const entries = Object.entries(d).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0));
  if (entries.length === 0) return null;

  return (
    <div className="panel-metal texture-brush rounded-xl p-5 animate-fade-up">
      <div className="label-tactical mb-4">Record Details</div>
      <dl className="divide-y divide-white/5">
        {entries.map(([k, v]) => (
          <div key={k} className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <dt className="label-tactical pt-0.5">{k}</dt>
            <dd className="min-w-0 font-mono text-[0.8rem] break-all text-foreground/90">
              {k === "Size" && typeof v === "number" ? (
                <span>{formatBytes(v)} <span className="text-muted-foreground">({v.toLocaleString()} bytes)</span></span>
              ) : k === "Also known as" && Array.isArray(v) ? (
                <span className="flex flex-wrap gap-1.5">
                  {v.map((n) => (
                    <span key={n} className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5">{n}</span>
                  ))}
                </span>
              ) : COPYABLE.has(k) && typeof v === "string" ? (
                <span className="inline-flex items-center gap-2">
                  <span className="break-all">{v}</span>
                  <button
                    onClick={() => navigator.clipboard?.writeText(v)}
                    className="shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    copy
                  </button>
                </span>
              ) : (
                String(v)
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function DnsPanel({ records }: { records: DnsRecord[] }) {
  return (
    <div className="panel-metal texture-brush rounded-xl overflow-hidden animate-fade-up">
      <div className="label-tactical border-b border-white/8 p-4">Latest DNS Records</div>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <tbody>
            {records.map((r, i) => (
              <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/4">
                <td className="w-20 px-4 py-2 font-mono text-xs text-primary">{r.type}</td>
                <td className="px-4 py-2 font-mono text-xs break-all">{r.value}</td>
                <td className="w-20 px-4 py-2 text-right font-mono text-xs text-muted-foreground">{r.ttl}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function WhoisPanel({ whois }: { whois: string }) {
  return (
    <div className="panel-metal texture-brush rounded-xl overflow-hidden animate-fade-up">
      <div className="label-tactical border-b border-white/8 p-4">Whois Record</div>
      <pre className="max-h-72 overflow-auto p-4 font-mono text-[0.7rem] leading-relaxed whitespace-pre-wrap text-foreground/75">
        {whois}
      </pre>
    </div>
  );
}

/* ---------------- Community votes ---------------- */

export function VotesBar({ votes }: { votes: NonNullable<VtReport["votes"]> }) {
  const total = votes.harmless + votes.malicious;
  if (total === 0) return null;
  const okPct = Math.round((votes.harmless / total) * 100);
  return (
    <div className="panel-metal texture-brush rounded-xl p-5 animate-fade-up">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="label-tactical">Community Verdict</div>
        <div className="font-mono text-xs text-muted-foreground">{total} votes</div>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full border border-white/10">
        <div className="bg-success transition-all duration-1000" style={{ width: `${okPct}%` }} />
        <div className="bg-destructive flex-1" />
      </div>
      <div className="mt-2 flex justify-between font-mono text-xs">
        <span className="text-success">{okPct}% harmless</span>
        <span className="text-destructive">{100 - okPct}% malicious</span>
      </div>
    </div>
  );
}

/* ---------------- Cyber Social Footer ---------------- */

export function ConsoleFooter() {
  return (
    <footer className="relative z-10 border-t border-white/8 py-8 text-center bg-black/45 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 flex flex-col items-center gap-5">
        {/* Blinking Cyber Threat Grid Telemetry Status */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
          <span className="h-2 w-2 rounded-full bg-primary animate-cyber-blink" />
          <span className="label-tactical text-primary">SecurOSINT · Live Threat Telemetry</span>
          <span className="h-2 w-2 rounded-full bg-success animate-cyber-blink" style={{ animationDelay: "0.75s" }} />
        </div>

        {/* Social Media Links with Cyber Blinking & Glow Effects */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* Instagram */}
          <a
            href="https://www.instagram.com/pranav_aitha/"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono text-xs text-foreground/85 transition-all duration-300 hover:border-[#E1306C]/70 hover:bg-[#E1306C]/10 hover:shadow-[0_0_20px_rgba(225,48,108,0.4)] hover:-translate-y-0.5"
          >
            <span className="h-2 w-2 rounded-full bg-[#E1306C] animate-cyber-blink" />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#E1306C] group-hover:scale-110 transition-transform">
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
            </svg>
            <span className="font-semibold tracking-wide">Instagram</span>
          </a>

          {/* X / Twitter */}
          <a
            href="https://x.com/PRANAV_AITHA"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono text-xs text-foreground/85 transition-all duration-300 hover:border-primary/70 hover:bg-primary/10 hover:shadow-[0_0_20px_rgba(6,182,212,0.45)] hover:-translate-y-0.5"
          >
            <span className="h-2 w-2 rounded-full bg-primary animate-cyber-blink" style={{ animationDelay: "0.4s" }} />
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-primary group-hover:scale-110 transition-transform">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span className="font-semibold tracking-wide">X / Twitter</span>
          </a>

          {/* GitHub */}
          <a
            href="https://github.com/pranav-aitha/"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono text-xs text-foreground/85 transition-all duration-300 hover:border-cyan-400/70 hover:bg-cyan-500/10 hover:shadow-[0_0_20px_rgba(34,211,238,0.45)] hover:-translate-y-0.5"
          >
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-cyber-blink" style={{ animationDelay: "0.8s" }} />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-cyan-400 group-hover:scale-110 transition-transform">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
            <span className="font-semibold tracking-wide">GitHub</span>
          </a>
        </div>

        {/* Creator Attribution */}
        <div className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
          <span>Engineered with</span>
          <span className="text-destructive animate-pulse-glow">❤</span>
          <span>By</span>
          <a
            href="https://github.com/pranav-aitha/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-cyan-glow hover:underline underline-offset-4"
          >
            Pranav Aitha
          </a>
        </div>
      </div>
    </footer>
  );
}
