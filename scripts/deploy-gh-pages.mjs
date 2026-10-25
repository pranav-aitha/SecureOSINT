import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

console.log("=== Building and Exporting for GitHub Pages ===");
execSync("npm run build", {
  stdio: "inherit",
  env: { ...process.env, GITHUB_PAGES: "true" },
});

console.log("=== Generating static assets & SPA routes ===");
execSync("node scripts/export-gh-pages.mjs", { stdio: "inherit" });

console.log("=== Publishing to gh-pages branch ===");
const distDir = path.join(process.cwd(), "gh-pages-dist");
const gitCmd = (cmd) => execSync(cmd, { cwd: distDir, stdio: "inherit" });

gitCmd("git init");
gitCmd("git checkout -B gh-pages");
gitCmd("git add -A");
gitCmd('git commit -m "Deploy to GitHub Pages" --allow-empty');
gitCmd("git remote add origin https://github.com/pranav-aitha/SecureOSINT.git");
gitCmd("git push origin gh-pages --force");

console.log("=== Deployed successfully to GitHub Pages! ===");
