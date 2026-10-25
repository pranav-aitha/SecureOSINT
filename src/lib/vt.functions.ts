import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  vtFetchReport,
  vtUploadFile,
  vtCheckAnalysis,
  type VtReport,
  type VtUploadResult,
  type AnalysisStatusResult,
} from "./vt.server";

export const vtLookup = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    z
      .object({
        type: z.enum(["file", "url", "domain", "ip"]),
        id: z.string().min(1).max(2048),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<VtReport> => {
    return vtFetchReport(data.type, data.id);
  });

export const vtRescanUrl = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({ url: z.string().min(1).max(2048) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const key = process.env["VIRUSTOTAL_API_KEY"] ?? "";
    if (!key) return { ok: false as const, error: "Upstream credentials are not configured." };
    const id = btoa(data.url).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    try {
      const res = await fetch("https://www.virustotal.com/api/v3/urls", {
        method: "POST",
        headers: { "x-apikey": key, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ url: data.url }).toString(),
      });
      if (res.status === 429) {
        return { ok: false as const, error: "Rate limit reached. Try again in a minute." };
      }
      if (!res.ok) {
        return { ok: false as const, error: "The analysis request was rejected upstream." };
      }
      return { ok: true as const, id };
    } catch {
      return { ok: false as const, error: "Could not reach the analysis service." };
    }
  });

export const vtUploadAndScan = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        fileBase64: z.string().min(1),
        fileName: z.string().min(1).max(255),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<VtUploadResult> => {
    return vtUploadFile(data.fileBase64, data.fileName);
  });

export const vtCheckAnalysisStatus = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    z
      .object({
        analysisId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<AnalysisStatusResult> => {
    return vtCheckAnalysis(data.analysisId);
  });
