import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="panel-metal max-w-md rounded-2xl p-10 text-center">
        <h1 className="font-display text-7xl font-bold text-metal">404</h1>
        <h2 className="mt-4 font-display text-xl font-semibold text-foreground">Sector not found</h2>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          This path does not exist in the console grid.
        </p>
        <div className="mt-6">
          <Link to="/" className="button-cta inline-flex items-center justify-center rounded-lg px-5 py-2.5 font-mono text-xs uppercase tracking-wider">
            Back to console
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="panel-metal max-w-md rounded-2xl p-10 text-center">
        <h1 className="font-display text-xl font-semibold text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          Something went wrong on our end. You can try again or head back to the console.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="button-cta rounded-lg px-5 py-2.5 font-mono text-xs uppercase tracking-wider"
          >
            Try again
          </button>
          <a href="/" className="button-metal rounded-lg px-5 py-2.5 font-mono text-xs uppercase tracking-wider">
            Back to console
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0d0f14" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: `${import.meta.env.BASE_URL}favicon.png`, type: "image/png" },
      { rel: "shortcut icon", href: `${import.meta.env.BASE_URL}favicon.png`, type: "image/png" },
      { rel: "apple-touch-icon", href: `${import.meta.env.BASE_URL}logo.png` },
      { rel: "alternate icon", href: `${import.meta.env.BASE_URL}favicon.ico`, type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
