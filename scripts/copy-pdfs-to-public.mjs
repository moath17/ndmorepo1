/**
 * Copy PDF files from /pdfs/ to /public/pdfs/ so they can be served statically.
 * This enables clickable source links in the chat interface.
 *
 * Usage: node scripts/copy-pdfs-to-public.mjs
 */

import { readdirSync, copyFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dirname || ".", "..");
const SOURCE_DIR = join(ROOT, "pdfs");
const DEST_DIR = join(ROOT, "public", "pdfs");

if (!existsSync(SOURCE_DIR)) {
  console.log("⚠️  No /pdfs/ directory found. Create it and place your PDFs there first.");
  process.exit(0);
}

// Create destination directory
mkdirSync(DEST_DIR, { recursive: true });

const files = readdirSync(SOURCE_DIR).filter((f) =>
  f.toLowerCase().endsWith(".pdf")
);

if (files.length === 0) {
  console.log("⚠️  No PDF files found in /pdfs/ directory.");
  process.exit(0);
}

let copied = 0;
for (const file of files) {
  const src = join(SOURCE_DIR, file);
  const dest = join(DEST_DIR, file);
  copyFileSync(src, dest);
  copied++;
  console.log(`  ✅ ${file}`);
}

console.log(`\n🎉 Copied ${copied} PDF files to /public/pdfs/`);
console.log("   Source links in the chat will now open the actual PDF pages.");
