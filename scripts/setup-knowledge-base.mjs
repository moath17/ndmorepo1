/**
 * NDMO Knowledge Base Setup Script
 * 
 * This script:
 * 1. Reads the PDF file(s) from the project root
 * 2. Extracts text page-by-page with [DOCUMENT: name | PAGE: N] markers
 * 3. Uploads the processed text to OpenAI Files API
 * 4. Creates or uses an existing Vector Store
 * 5. Adds the file to the Vector Store
 * 6. Prints the Vector Store ID to set in .env.local
 * 
 * Usage:
 *   node scripts/setup-knowledge-base.mjs
 * 
 * Requires:
 *   - OPENAI_API_KEY in .env.local
 *   - Policies001.pdf in the project root
 */

import { readFileSync, existsSync } from "fs";
import { resolve, basename } from "path";
import OpenAI from "openai";
import pdf from "pdf-parse/lib/pdf-parse.js";

// --- Configuration ---
const PDF_FILES = ["Policies001.pdf"]; // Add more filenames here if needed
const VECTOR_STORE_NAME = "ndmo-policies";

// --- Load .env.local ---
function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    console.error("ERROR: .env.local not found. Create it with your OPENAI_API_KEY.");
    process.exit(1);
  }
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY is not set in .env.local");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Extract text per page ---
async function extractPages(pdfPath) {
  console.log(`\n📄 Reading: ${pdfPath}`);
  const buffer = readFileSync(pdfPath);
  
  const pageTexts = [];
  
  const options = {
    pagerender: async function (pageData) {
      const textContent = await pageData.getTextContent();
      const strings = textContent.items.map((item) => item.str);
      const pageText = strings.join(" ").trim();
      pageTexts.push(pageText);
      return pageText;
    },
  };

  const data = await pdf(buffer, options);
  console.log(`   Total pages: ${data.numpages}`);
  console.log(`   Pages with text: ${pageTexts.filter(t => t.length > 0).length}`);
  
  return { pageTexts, totalPages: data.numpages };
}

// --- Format pages with markers ---
function formatPages(filename, pageTexts) {
  const sections = [];
  for (let i = 0; i < pageTexts.length; i++) {
    if (pageTexts[i].length > 0) {
      sections.push(`[DOCUMENT: ${filename} | PAGE: ${i + 1}]\n${pageTexts[i]}`);
    }
  }
  return sections.join("\n\n---\n\n");
}

// --- Main ---
async function main() {
  console.log("=== NDMO Knowledge Base Setup ===\n");

  // Check if PDF files exist
  for (const pdfFile of PDF_FILES) {
    const pdfPath = resolve(process.cwd(), pdfFile);
    if (!existsSync(pdfPath)) {
      console.error(`ERROR: ${pdfFile} not found in project root.`);
      console.error(`  Expected at: ${pdfPath}`);
      process.exit(1);
    }
  }

  // Step 1: Create or use existing Vector Store
  let vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
  
  if (vectorStoreId && vectorStoreId !== "vs_...") {
    console.log(`Using existing Vector Store: ${vectorStoreId}`);
  } else {
    console.log("Creating new Vector Store...");
    const vs = await openai.vectorStores.create({ name: VECTOR_STORE_NAME });
    vectorStoreId = vs.id;
    console.log(`Created Vector Store: ${vectorStoreId}`);
  }

  // Step 2: Process each PDF
  for (const pdfFile of PDF_FILES) {
    const pdfPath = resolve(process.cwd(), pdfFile);
    
    // Extract pages
    const { pageTexts, totalPages } = await extractPages(pdfPath);
    
    // Format with markers
    const formattedContent = formatPages(pdfFile, pageTexts);
    console.log(`   Formatted text size: ${(formattedContent.length / 1024).toFixed(0)} KB`);

    // Upload to OpenAI Files API
    console.log(`   Uploading to OpenAI Files API...`);
    const txtFilename = pdfFile.replace(".pdf", ".txt");
    const blob = new Blob([formattedContent], { type: "text/plain" });
    const file = new File([blob], txtFilename, { type: "text/plain" });
    
    const fileResponse = await openai.files.create({
      file: file,
      purpose: "assistants",
    });
    console.log(`   File uploaded: ${fileResponse.id}`);

    // Add to Vector Store
    console.log(`   Adding to Vector Store...`);
    await openai.vectorStores.files.create(vectorStoreId, {
      file_id: fileResponse.id,
    });

    // Wait for indexing
    console.log(`   Waiting for indexing to complete...`);
    let status = "in_progress";
    let attempts = 0;
    while (status === "in_progress" && attempts < 120) {
      await new Promise((r) => setTimeout(r, 5000));
      const fileStatus = await openai.vectorStores.files.retrieve(
        vectorStoreId,
        fileResponse.id
      );
      status = fileStatus.status;
      attempts++;
      if (attempts % 6 === 0) {
        console.log(`   Still indexing... (${attempts * 5}s)`);
      }
    }

    if (status === "completed") {
      console.log(`   ✅ ${pdfFile} indexed successfully! (${totalPages} pages)`);
    } else {
      console.error(`   ❌ Indexing failed with status: ${status}`);
    }
  }

  // Done
  console.log("\n=== Setup Complete ===\n");
  console.log("Add this to your .env.local:\n");
  console.log(`OPENAI_VECTOR_STORE_ID=${vectorStoreId}`);
  console.log("\nThen run: npm run dev");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
