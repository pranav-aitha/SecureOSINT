import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { vtLookup, vtRescanUrl } from "@/lib/vt.functions";
import {
  ConsoleHeader,
  ConsoleFooter,
  DetailPanel,
  DnsPanel,
  EnginesTable,
  VerdictDial,
  StatCard,
  VotesBar,
  WhoisPanel,
  verdictOf,
  VERDICT_META,
} from "@/components/secur/ui";
import { CyberBackground } from "@/components/secur/CyberBackground";
import { IOC_LABELS, type IocType } from "@/lib/detect";
import { useState, useEffect, useCallback } from "react";

export const Route = createFileRoute("/report/$type/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${decodeURIComponent(params.id).slice(0, 48)} · SecurOSINT Report` },
      {
        name: "description",
        content: `Multi-vendor security analysis for ${params.id} — verdicts from 70+ engines, DNS, whois and infrastructure data on SecurOSINT.`,
      },
      { property: "og:title", content: `SecurOSINT Report · ${params.id}` },
      {
        property: "og:description",
        content: "Multi-vendor verdicts, infrastructure data and threat classification.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["vt", params.type, params.id],
        queryFn: () => vtLookup({ data: { type: params.type as IocType, id: params.id } }),
      }),
    ),
  pendingComponent: ScanPending,
  component: ReportPage,
});

function ScanPending() {
  const { type, id } = Route.useParams();
  return (
    <div className="relative min-h-screen overflow-hidden">
      <CyberBackground />
      <ConsoleHeader />
      <main className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 pt-28 text-center">
        <div className="panel-metal texture-brush w-full overflow-hidden rounded-2xl p-10">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="26" stroke="oklch(1 0 0 / 10%)" strokeWidth="4" />
              <circle
                cx="32"
                cy="32"
                r="26"
                stroke="oklch(0.84 0.135 195)"
                strokeWidth="4"
                strokeDasharray="40 200"
                strokeLinecap="round"
                className="animate-spin-slow origin-center"
              />
            </svg>
          </div>
          <div className="label-tactical text-primary">Analyzing indicator</div>
          <div className="mt-2 truncate font-mono text-sm text-foreground/85">{decodeURIComponent(id)}</div>
          <div className="relative mt-8 h-1 overflow-hidden rounded-full bg-white/8">
            <div className="absolute inset-y-0 w-1/3 animate-scan-sweep rounded-full bg-[linear-gradient(90deg,transparent,oklch(0.84_0.135_195),transparent)]" />
          </div>
          <div className="mt-4 font-mono text-xs text-muted-foreground">
            querying {IOC_LABELS[type as IocType] ?? type} across vendor engines…
          </div>
        </div>
      </main>
    </div>
  );
}

function FileQueuePendingCard({ hash, onRetry }: { hash: string; onRetry: () => void }) {
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (attempt >= 12) return;
    const timer = setTimeout(() => {
      setAttempt((prev) => prev + 1);
      onRetry();
    }, 3500);
    return () => clearTimeout(timer);
  }, [attempt, onRetry]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await onRetry();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="panel-metal texture-brush mx-auto max-w-xl rounded-2xl p-8 text-center border border-primary/30 shadow-[0_0_35px_rgba(6,182,212,0.15)] animate-fade-up">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary shadow-[0_0_20px_rgba(6,182,212,0.3)]">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin-slow">
          <circle cx="12" cy="12" r="10" strokeDasharray="30 60" />
        </svg>
      </div>
      <div className="label-tactical text-primary">VirusTotal Threat Analysis in Progress</div>
      <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">
        Polling 70+ Vendor Engine Verdicts
      </div>
      <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-muted-foreground font-mono">
        Files submitted to VirusTotal are currently being evaluated in sandbox environments. Results typically finalize within a few moments.
      </p>

      {/* Progress & Attempt counter */}
      <div className="mt-6 rounded-xl border border-white/10 bg-black/40 p-3.5 text-left font-mono text-xs">
        <div className="flex justify-between items-center text-muted-foreground mb-2">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
            Auto-polling intelligence feed...
          </span>
          <span className="text-cyan-glow font-bold">Attempt {attempt} / 12</span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.6)]"
            style={{ width: `${Math.min(100, (attempt / 12) * 100)}%` }}
          />
        </div>
        <div className="mt-2.5 truncate text-[0.7rem] text-muted-foreground/80">
          SHA-256: <span className="text-foreground">{decodeURIComponent(hash)}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="button-cta flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider"
        >
          {isRefreshing ? (
            <>
              <span className="h-3 w-3 rounded-full border-2 border-black border-t-transparent animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
              Refresh Results Now
            </>
          )}
        </button>

        <button
          onClick={() => navigate({ to: "/" })}
          className="button-metal rounded-xl px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Back to Console
        </button>
      </div>
    </div>
  );
}

function ReportPage() {
  const { type, id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rescanState, setRescanState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  const handleRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["vt", type, id] });
  }, [queryClient, type, id]);

  const { data: report } = useSuspenseQuery(
    queryOptions({
      queryKey: ["vt", type, id],
      queryFn: () => vtLookup({ data: { type: type as IocType, id } }),
    }),
  );

  if (!report.ok && !report.notFound) {
    return (
      <ReportShell>
        <StateCard
          title="Analysis unavailable"
          body={report.error ?? "Something went wrong while fetching this report."}
          action={{ label: "Back to console", onClick: () => navigate({ to: "/" }) }}
        />
      </ReportShell>
    );
  }

  if (report.notFound) {
    if (type === "file") {
      return (
        <ReportShell>
          <FileQueuePendingCard hash={id} onRetry={handleRefetch} />
        </ReportShell>
      );
    }

    return (
      <ReportShell>
        <StateCard
          title="No records found"
          body="This indicator has never been analyzed by the vendor network."
          action={{
            label: "Back to console",
            onClick: () => navigate({ to: "/" }),
          }}
        />
      </ReportShell>
    );
  }

  const verdict = verdictOf(report);
  const s = report.stats!;
  const accentCls =
    verdict === "malicious"
      ? "border-destructive/40 from-destructive/12"
      : verdict === "suspicious"
        ? "border-warning/40 from-warning/12"
        : "border-success/40 from-success/12";

  const rescan = async () => {
    setRescanState("sending");
    try {
      const res = await vtRescanUrl({ data: { url: report.details?.["URL"] ?? report.id } });
      setRescanState(res.ok ? "sent" : "failed");
    } catch {
      setRescanState("failed");
    }
  };

  return (
    <ReportShell>
      <div className="space-y-4">
        {/* Indicator + verdict banner */}
        <section className={`panel-metal texture-brush rounded-2xl border-2 bg-gradient-to-br to-transparent p-6 ${accentCls}`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <span className="label-tactical">{VERDICT_META[verdict].label} · Analysis Report</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate({ to: "/" })}
                className="button-metal rounded-lg px-3 py-1.5 font-mono text-[0.68rem] uppercase tracking-wider"
              >
                ← new scan
              </button>
              {type === "url" && (
                <button
                  onClick={rescan}
                  disabled={rescanState === "sending"}
                  className="button-metal rounded-lg px-3 py-1.5 font-mono text-[0.68rem] uppercase tracking-wider"
                >
                  {rescanState === "sending"
                    ? "queuing…"
                    : rescanState === "sent"
                      ? "queued (refresh shortly)"
                      : rescanState === "failed"
                        ? "rescan failed"
                        : "rescan url"}
                </button>
              )}
            </div>
          </div>
          <div className="break-all font-mono text-lg font-semibold text-foreground sm:text-xl">
            {decodeURIComponent(id)}
          </div>
        </section>

        {/* Verdict dial + quick stats */}
        <section className="panel-metal texture-brush rounded-2xl p-6">
          <VerdictDial report={report} />
        </section>

        {/* Counts breakdown */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Malicious" value={s.malicious} tone="danger" />
          <StatCard label="Suspicious" value={s.suspicious} tone="warn" />
          <StatCard label="Undetected" value={s.undetected} tone="muted" />
          <StatCard label="Harmless" value={s.harmless} tone="ok" />
        </section>

        {/* Community votes */}
        {report.votes && <VotesBar votes={report.votes} />}

        {/* Engine table + context panels */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {report.engines && report.engines.length > 0 && <EnginesTable engines={report.engines} />}
          </div>
          <div className="space-y-4">
            <DetailPanel report={report} />
            {report.dns && report.dns.length > 0 && <DnsPanel records={report.dns} />}
            {report.whois && <WhoisPanel whois={report.whois} />}
          </div>
        </div>
      </div>
    </ReportShell>
  );
}

function ReportShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <CyberBackground />
      <ConsoleHeader />
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-10">
        <Link to="/" className="mb-4 inline-block font-mono text-xs text-muted-foreground transition-colors hover:text-primary">
          ← back to console
        </Link>
        {children}
      </main>
      <ConsoleFooter />
    </div>
  );
}

function StateCard({ title, body, action }: { title: string; body: string; action: { label: string; onClick: () => void } }) {
  return (
    <div className="panel-metal texture-brush mx-auto max-w-xl rounded-2xl p-10 text-center animate-fade-up">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-warning/40 bg-warning/10 text-2xl text-warning">
        !
      </div>
      <div className="font-display text-xl font-semibold">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      <button onClick={action.onClick} className="button-metal mt-6 rounded-lg px-5 py-2.5 font-mono text-xs uppercase tracking-wider">
        {action.label}
      </button>
    </div>
  );
}
