#!/usr/bin/env node
// Stages dist/ as a valid Tizen widget project: Vite only copies public/
// into dist/, but config.xml lives at the repo root (it isn't a browser
// asset), so without this step dist/ is missing the one file every Tizen
// packaging tool actually requires alongside index.html.
//
// This script deliberately stops there. Signing and installing a .wgt needs
// your own Samsung certificate profile and either Tizen Studio or the
// `tizen`/`sdb` CLI tools — neither of which this repo has, and neither of
// which should ever be automated with someone else's private certificate.
// See README.md's "Packaging for a real Samsung TV" section for the manual
// steps from here.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const distDir = path.join(root, "dist");
const configSrc = path.join(root, "config.xml");
const configDest = path.join(distDir, "config.xml");

if (!fs.existsSync(distDir)) {
  console.error("dist/ not found. Run `npm run build` first — `npm run package` does this automatically.");
  process.exit(1);
}

fs.copyFileSync(configSrc, configDest);
console.log(`Copied config.xml -> ${path.relative(root, configDest)}`);

if (!fs.existsSync(path.join(distDir, "icon.png"))) {
  console.warn("Warning: dist/icon.png not found — config.xml references icon.png, packaging will likely fail without it.");
}

console.log("\ndist/ is now a valid Tizen widget project (index.html + config.xml + icon.png).");
console.log("Next: open it in Tizen Studio (or run the tizen CLI) with your own certificate to sign and install a .wgt.");
console.log("See README.md's \"Packaging for a real Samsung TV\" section for the full steps.");
