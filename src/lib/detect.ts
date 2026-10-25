export type IocType = "file" | "url" | "domain" | "ip";

export const IOC_LABELS: Record<IocType, string> = {
  file: "FILE HASH",
  url: "URL",
  domain: "DOMAIN",
  ip: "IP ADDRESS",
};

const HASH_RE = /^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$/;
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

export function detectIoc(input: string): IocType | null {
  const v = input.trim();
  if (!v || /\s/.test(v)) return null;
  if (HASH_RE.test(v)) return "file";
  if (IPV4_RE.test(v)) return "ip";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return "url";
  if (v.includes("/") || v.includes("?") || v.includes("#")) return "url";
  if (/^www\./i.test(v)) return "url";
  // domain-ish: something.tld, possibly with subdomains
  if (/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(v)) return "domain";
  // bare hostname without dot — treat as domain, VT will 404 if unknown
  if (/^[a-z0-9][a-z0-9.-]*$/i.test(v)) return "domain";
  return null;
}

/** Base64url id for URL lookups (VirusTotal convention), ASCII-safe in a path. */
export function toUrlParam(url: string): string {
  const v = url.trim();
  if (/^[A-Za-z0-9_-]+$/.test(v) && !v.includes(":")) return v;
  return btoa(v).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function idForNav(type: IocType, raw: string): string {
  return type === "url" ? toUrlParam(raw) : raw.trim();
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
