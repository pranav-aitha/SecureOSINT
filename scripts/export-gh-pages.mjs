import fs from "node:fs";
import path from "node:path";

async function main() {
  const rootDir = process.cwd();
  const outDir = path.join(rootDir, "gh-pages-dist");
  const staticDir = path.join(rootDir, ".vercel", "output", "static");
  const serverEntry = path.join(rootDir, ".vercel", "output", "functions", "__server.func", "index.mjs");

  if (!fs.existsSync(serverEntry)) {
    console.error("Server entry not found at:", serverEntry);
    process.exit(1);
  }

  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Copy static assets (assets/, logo.png, favicon.*, etc.)
  fs.cpSync(staticDir, outDir, { recursive: true });

  // 2. Fetch pre-rendered SSR HTML from local server bundle
  const server = await import(`file://${serverEntry.replace(/\\/g, "/")}`);
  const res = await server.default.fetch(new Request("http://localhost/SecureOSINT/"));
  let html = await res.text();

  // Inject SPA URL decoder into head
  const spaDecoderScript = `<script>(function(l){if(l.search[1]==='/'){var d=l.search.slice(1).split('&').map(function(s){return s.replace(/~and~/g,'&')}).join('?');window.history.replaceState(null,null,l.pathname.slice(0,-1)+d+l.hash)}})(window.location);</script>`;
  html = html.replace("<head>", `<head>${spaDecoderScript}`);

  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf-8");
  console.log("Generated index.html (size: " + html.length + " bytes)");

  // 3. Generate 404.html for GitHub Pages SPA routing
  const spa404Html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>SecurOSINT — Threat Intelligence Console</title>
    <script>
      var pathSegmentsToKeep = 1;
      var l = window.location;
      l.replace(
        l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
        l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
        l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
        (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
        l.hash
      );
    </script>
  </head>
  <body></body>
</html>`;
  fs.writeFileSync(path.join(outDir, "404.html"), spa404Html, "utf-8");
  console.log("Generated 404.html");

  // 4. Create .nojekyll
  fs.writeFileSync(path.join(outDir, ".nojekyll"), "", "utf-8");
  console.log("Generated .nojekyll");

  console.log("Successfully prepared gh-pages-dist ready for deployment!");
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
