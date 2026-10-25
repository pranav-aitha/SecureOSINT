/**
 * Server-only VirusTotal v3 client. Never import from client code.
 * The API key lives in the secret store (VIRUSTOTAL_API_KEY) and is read
 * inside the handler at call time.
 */

const VT_BASE = "https://www.virustotal.com/api/v3";

export type VtKind = "file" | "url" | "domain" | "ip";

export interface EngineResult {
  engine: string;
  category: string;
  result: string | null;
}

export interface VtReport {
  ok: boolean;
  kind: VtKind;
  id: string;
  error?: string | undefined;
  notFound?: boolean | undefined;
  stats?:
    | {
        harmless: number;
        malicious: number;
        suspicious: number;
        undetected: number;
        timeout: number;
      }
    | undefined;
  engines?: EngineResult[] | undefined;
  reputation?: number | undefined;
  votes?: { harmless: number; malicious: number } | undefined;
  threatLabel?: string | undefined;
  details?: Record<string, string | number | boolean | null | string[]> | undefined;
  dns?: DnsRecord[] | undefined;
  whois?: string | undefined;
  categories?: string[] | undefined;
  tags?: string[] | undefined;
}

export interface DnsRecord {
  type: string;
  value: string;
  ttl: number;
}

interface VtAttrs {
  last_analysis_stats?: Record<string, number>;
  last_analysis_results?: Record<
    string,
    { engine_name?: string; category?: string; result?: string | null }
  >;
  reputation?: number;
  votes?: { harmless?: number; malicious?: number };
  popular_threat_classification?: { suggested_threat_label?: string };
  categories?: Record<string, string>;
  tags?: string[];
  [key: string]: unknown;
}

/**
 * Free VirusTotal keys allow ~4 lookups per minute. A shared sliding window
 * keeps bursts under the upstream limit so users rarely see hard 429s.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 4;
let upstreamCalls: number[] = [];

async function throttleUpstream(): Promise<"ready" | "busy"> {
  const now = Date.now();
  upstreamCalls = upstreamCalls.filter((t) => now - t < WINDOW_MS);
  if (upstreamCalls.length < MAX_PER_WINDOW) {
    upstreamCalls.push(now);
    return "ready";
  }
  const oldest = upstreamCalls[0];
  if (oldest === undefined) {
    upstreamCalls.push(now);
    return "ready";
  }
  const waitMs = WINDOW_MS - (now - oldest) + 60;
  if (waitMs > 12_000) return "busy";
  await new Promise((r) => setTimeout(r, waitMs));
  upstreamCalls.push(Date.now());
  return "ready";
}

function iso(ts: unknown): string | null {
  if (typeof ts === "number" && Number.isFinite(ts)) {
    return new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function toBase64UrlId(raw: string): string {
  // Accept an already-encoded base64url id or a raw URL.
  if (/^[A-Za-z0-9_-]+$/.test(raw) && !raw.includes(":")) return raw;
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildDetails(kind: VtKind, a: VtAttrs): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  if (kind === "file") {
    d["Name"] = str(a["meaningful_name"]);
    d["SHA-256"] = str(a["sha256"]);
    d["SHA-1"] = str(a["sha1"]);
    d["MD5"] = str(a["md5"]);
    d["Type"] = str(a["type_description"]);
    d["Size"] = typeof a["size"] === "number" ? a["size"] : null;
    d["First seen"] = iso(a["first_submission_date"]);
    d["Last seen"] = iso(a["last_submission_date"]);
    d["Created"] = iso(a["creation_date"]);
    const names = a["names"];
    if (Array.isArray(names)) d["Also known as"] = names.slice(0, 12).filter((n) => typeof n === "string");
  } else if (kind === "domain") {
    d["Registrar"] = str(a["registrar"]);
    d["Registered"] = iso(a["creation_date"]);
    d["Last updated"] = iso(a["last_update_date"]);
    d["Expiration"] = iso(a["expiration_date"]);
    const recs = a["last_dns_records"];
    if (Array.isArray(recs)) {
      d["dns"] = recs
        .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
        .map((r) => ({
          type: String(r["type"] ?? ""),
          value: String(r["value"] ?? ""),
          ttl: typeof r["ttl"] === "number" ? r["ttl"] : 0,
        }))
        .slice(0, 20);
    }
    const whois = str(a["whois"]);
    if (whois) d["whois"] = whois.slice(0, 2400);
  } else if (kind === "ip") {
    d["Country"] = str(a["country"]);
    d["Continent"] = str(a["continent"]);
    d["Network owner"] = str(a["as_owner"]);
    d["ASN"] = typeof a["asn"] === "number" ? a["asn"] : null;
    d["Network"] = str(a["network"]);
    d["Registry"] = str(a["whois"]);
    const whois = str(a["whois"]);
    if (whois) d["whois"] = whois.slice(0, 2400);
  } else {
    d["URL"] = str(a["url"]);
    d["Final URL"] = str(a["last_final_url"] ?? a["final_url"]);
    d["Title"] = str(a["title"]);
    d["First submitted"] = iso(a["first_submission_date"]);
    d["Last submitted"] = iso(a["last_submission_date"]);
  }
  return d;
}

function mapCategories(raw: unknown): string[] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const vals = new Set<string>();
  for (const v of Object.values(raw as Record<string, unknown>)) {
    if (typeof v === "string") vals.add(v);
  }
  return vals.size ? [...vals] : undefined;
}

export async function vtFetchReport(kind: VtKind, rawId: string): Promise<VtReport> {
  const key = process.env["VIRUSTOTAL_API_KEY"] ?? "";
  if (!key) {
    return { ok: false, kind, id: rawId, error: "Upstream credentials are not configured." };
  }

  const path =
    kind === "file"
      ? `/files/${encodeURIComponent(rawId)}`
      : kind === "url"
        ? `/urls/${toBase64UrlId(rawId)}`
        : kind === "domain"
          ? `/domains/${encodeURIComponent(rawId)}`
          : `/ip_addresses/${encodeURIComponent(rawId)}`;

  const slot = await throttleUpstream();
  if (slot === "busy") {
    return {
      ok: false,
      kind,
      id: rawId,
      error: "The intelligence service is busy right now — free analysis quota resets every minute. Try again shortly.",
    };
  }

  try {
    const res = await fetch(`${VT_BASE}${path}`, {
      headers: { "x-apikey": key, accept: "application/json" },
    });

    if (res.status === 404) {
      return { ok: true, kind, id: rawId, notFound: true };
    }
    if (res.status === 429) {
      return {
        ok: false,
        kind,
        id: rawId,
        error: "Rate limit reached on the upstream intelligence feed. Wait a minute and retry.",
      };
    }
    if (!res.ok) {
      console.error(`[SecurOSINT] upstream ${res.status} for ${kind}`);
      return { ok: false, kind, id: rawId, error: "The intelligence service returned an error." };
    }

    const json = (await res.json()) as { data?: { attributes?: VtAttrs } };
    const attrs = json.data?.attributes;
    if (!attrs) return { ok: true, kind, id: rawId, notFound: true };

    const statsRaw = attrs.last_analysis_stats ?? {};
    const stats = {
      harmless: statsRaw["harmless"] ?? 0,
      malicious: statsRaw["malicious"] ?? 0,
      suspicious: statsRaw["suspicious"] ?? 0,
      undetected: statsRaw["undetected"] ?? 0,
      timeout: statsRaw["timeout"] ?? 0,
    };

    const engines: EngineResult[] = Object.entries(attrs.last_analysis_results ?? {}).map(
      ([name, r]) => ({
        engine: r?.engine_name ?? name,
        category: r?.category ?? "undetected",
        result: r?.result ?? null,
      }),
    );
    engines.sort((a, b) => a.engine.localeCompare(b.engine));

    const votes = attrs.votes ?? {};
    const details = buildDetails(kind, attrs);
    const dns = details["dns"] as DnsRecord[] | undefined;
    if (dns) delete details["dns"];
    const whois = details["whois"] as string | undefined;
    if (whois) delete details["whois"];

    return {
      ok: true,
      kind,
      id: rawId,
      stats,
      engines,
      reputation: attrs.reputation,
      votes: { harmless: votes.harmless ?? 0, malicious: votes.malicious ?? 0 },
      threatLabel: str(attrs.popular_threat_classification?.suggested_threat_label) ?? undefined,
      categories: mapCategories(attrs.categories),
      tags: Array.isArray(attrs.tags) ? attrs.tags.slice(0, 14) : undefined,
      details: details as Record<string, string | number | boolean | null | string[]>,
      ...(dns ? { dns } : {}),
      ...(whois ? { whois } : {}),
    };
  } catch (err) {
    console.error("[SecurOSINT] upstream fetch failed", err);
    return { ok: false, kind, id: rawId, error: "Could not reach the intelligence service." };
  }
}

export interface VtUploadResult {
  ok: boolean;
  sha256?: string;
  analysisId?: string;
  error?: string;
}

export async function vtUploadFile(
  fileBase64: string,
  fileName: string,
): Promise<VtUploadResult> {
  const key = process.env["VIRUSTOTAL_API_KEY"] ?? "";
  if (!key) {
    return { ok: false, error: "Upstream credentials are not configured." };
  }

  try {
    const binary = Buffer.from(fileBase64, "base64");
    const formData = new FormData();
    const blob = new Blob([binary]);
    formData.append("file", blob, fileName || "file.bin");

    const res = await fetch(`${VT_BASE}/files`, {
      method: "POST",
      headers: {
        "x-apikey": key,
      },
      body: formData,
    });

    if (res.status === 429) {
      return { ok: false, error: "Rate limit reached on VirusTotal. Please wait a minute and retry." };
    }
    if (!res.ok) {
      const errText = await res.text();
      console.error("[SecurOSINT] VT upload error:", res.status, errText);
      return { ok: false, error: "VirusTotal rejected the file upload." };
    }

    const json = (await res.json()) as { data?: { id?: string } };
    const analysisId = json.data?.id;

    let sha256: string | undefined;
    if (analysisId) {
      try {
        const aRes = await fetch(`${VT_BASE}/analyses/${analysisId}`, {
          headers: { "x-apikey": key },
        });
        if (aRes.ok) {
          const aData = (await aRes.json()) as { meta?: { file_info?: { sha256?: string } } };
          sha256 = aData.meta?.file_info?.sha256;
        }
      } catch {
        /* fallback */
      }
    }

    return { ok: true, analysisId, sha256 };
  } catch (err) {
    console.error("[SecurOSINT] VT upload exception:", err);
    return { ok: false, error: "Could not upload file to the analysis service." };
  }
}

export interface AnalysisStatusResult {
  ok: boolean;
  status?: "queued" | "in-progress" | "completed";
  sha256?: string;
  error?: string;
}

export async function vtCheckAnalysis(analysisId: string): Promise<AnalysisStatusResult> {
  const key = process.env["VIRUSTOTAL_API_KEY"] ?? "";
  if (!key) return { ok: false, error: "Credentials not configured" };

  try {
    const res = await fetch(`${VT_BASE}/analyses/${encodeURIComponent(analysisId)}`, {
      headers: { "x-apikey": key },
    });
    if (!res.ok) {
      return { ok: false, error: "Could not fetch analysis status" };
    }
    const data = (await res.json()) as {
      data?: { attributes?: { status?: "queued" | "in-progress" | "completed" } };
      meta?: { file_info?: { sha256?: string } };
    };
    return {
      ok: true,
      status: data.data?.attributes?.status,
      sha256: data.meta?.file_info?.sha256,
    };
  } catch (err) {
    return { ok: false, error: "Network error checking analysis" };
  }
}
