import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

if (typeof window !== "undefined" && window.location.hostname.includes("github.io")) {
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === "string" && input.includes("/_server")) {
      const idx = input.indexOf("/_server");
      const vercelUrl = "https://secureosint-main.vercel.app" + input.slice(idx);
      return originalFetch(vercelUrl, init);
    }
    return originalFetch(input, init);
  };
}

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests while permitting GitHub Pages client RPCs.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => {
    const origin =
      ctx.request?.headers?.get?.("Origin") ??
      ctx.request?.headers?.get?.("origin");
    if (origin && origin.includes("github.io")) {
      return false;
    }
    return ctx.handlerType === "serverFn";
  },
  origin: ["https://pranav-aitha.github.io", "https://secureosint-main.vercel.app"],
});

const gitHubPagesMiddleware = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const isGitHubPages =
      typeof window !== "undefined" &&
      window.location.hostname.includes("github.io");
    if (isGitHubPages) {
      const customFetch = (url: RequestInfo | URL, init?: RequestInit) => {
        let finalUrl = url;
        if (typeof url === "string" && url.startsWith("/_server")) {
          finalUrl = `https://secureosint-main.vercel.app${url}`;
        }
        return fetch(finalUrl, init);
      };
      return next({ fetch: customFetch });
    }
    return next();
  },
);

export const startInstance = createStart(() => ({
  functionMiddleware: [gitHubPagesMiddleware, attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
