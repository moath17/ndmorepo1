/**
 * NDMO Knowledge Base Setup Script
 * 
 * This script:
 * 1. Reads the PDF file(s) from the pdfs/ directory
 * 2. Extracts text page-by-page with [DOCUMENT: name | PAGE: N] markers
 * 3. Optionally runs OCR (OpenAI Vision) on image-based pages
 * 4. Uploads the processed text to OpenAI Files API
 * 5. Creates or uses an existing Vector Store
 * 6. Adds the file to the Vector Store
 * 7. Prints the Vector Store ID to set in .env.local
 * 
 * Usage:
 *   node scripts/setup-knowledge-base.mjs              # text extraction + OCR (default)
 *   node scripts/setup-knowledge-base.mjs --no-ocr     # text extraction only, skip OCR
 * 
 * Requires:
 *   - OPENAI_API_KEY in .env.local
 *   - PDF files in pdfs/ directory
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "fs";
import { resolve, basename, extname } from "path";
import { createHash } from "crypto";
import OpenAI from "openai";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { PDFDocument } from "pdf-lib";

// --- Flags ---
const WITH_OCR = !process.argv.includes("--no-ocr"); // OCR enabled by default; use --no-ocr to disable
const FORCE = process.argv.includes("--force"); // Re-process even if cached
const OCR_MODEL = "gpt-4o-mini";
const MIN_TEXT_LENGTH = 50;

// --- File tracking ---
const DATA_DIR = resolve(process.cwd(), "data");
const TRACKER_FILE = resolve(DATA_DIR, "processed-files.json");

function computeFileHash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function loadTracker() {
  if (!existsSync(TRACKER_FILE)) return { files: [] };
  return JSON.parse(readFileSync(TRACKER_FILE, "utf-8"));
}

function saveTracker(data) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(TRACKER_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function isAlreadyProcessed(hash) {
  const data = loadTracker();
  return data.files.find((f) => f.hash === hash) || null;
}

function markProcessed(entry) {
  const data = loadTracker();
  data.files = data.files.filter((f) => f.hash !== entry.hash);
  data.files.push(entry);
  saveTracker(data);
}

// --- Configuration ---
const PDF_DIR = "pdfs"; // Directory containing PDF files
const VECTOR_STORE_NAME = "ndmo-policies";

// Auto-detect all PDF files in the pdfs/ directory
function getPdfFiles() {
  const pdfDir = resolve(process.cwd(), PDF_DIR);
  if (!existsSync(pdfDir)) {
    console.error(`ERROR: ${PDF_DIR}/ directory not found.`);
    process.exit(1);
  }
  const files = readdirSync(pdfDir)
    .filter((f) => extname(f).toLowerCase() === ".pdf")
    .map((f) => f);
  if (files.length === 0) {
    console.error(`ERROR: No PDF files found in ${PDF_DIR}/`);
    process.exit(1);
  }
  return files;
}

const PDF_FILES = getPdfFiles();

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

// --- OCR: extract single page from PDF ---
async function extractSinglePagePdf(pdfBuffer, pageIndex) {
  const srcDoc = await PDFDocument.load(pdfBuffer);
  const newDoc = await PDFDocument.create();
  const [copiedPage] = await newDoc.copyPages(srcDoc, [pageIndex]);
  newDoc.addPage(copiedPage);
  const pdfBytes = await newDoc.save();
  return Buffer.from(pdfBytes);
}

// --- OCR: send page to OpenAI Vision ---
async function ocrPage(pageBuffer, pageNumber, documentName) {
  const base64Pdf = pageBuffer.toString("base64");
  try {
    const response = await openai.chat.completions.create({
      model: OCR_MODEL,
      temperature: 0,
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract ALL text from this PDF page exactly as written. Preserve the original language (Arabic or English). Return ONLY the extracted text. If there is a table or chart, describe its structure and content. If there is no text at all, return NO_TEXT_FOUND.",
            },
            {
              type: "file",
              file: {
                filename: `${documentName}_page_${pageNumber}.pdf`,
                file_data: `data:application/pdf;base64,${base64Pdf}`,
              },
            },
          ],
        },
      ],
    });
    const text = response.choices[0]?.message?.content?.trim() || "";
    return text === "NO_TEXT_FOUND" ? "" : text;
  } catch (err) {
    console.error(`   OCR failed for page ${pageNumber}: ${err.message || err}`);
    return "";
  }
}

// --- OCR: enhance page texts with Vision for image pages ---
async function enhanceWithOCR(pdfBuffer, pageTexts, documentName) {
  const enhanced = [...pageTexts];
  const imagePages = [];
  for (let i = 0; i < pageTexts.length; i++) {
    if (pageTexts[i].trim().length < MIN_TEXT_LENGTH) {
      imagePages.push(i);
    }
  }
  if (imagePages.length === 0) {
    console.log("   No image-based pages found — skipping OCR.");
    return enhanced;
  }
  console.log(`   Found ${imagePages.length} image-based pages. Running OCR...`);
  for (const idx of imagePages) {
    const pageNum = idx + 1;
    const singlePageBuf = await extractSinglePagePdf(pdfBuffer, idx);
    const ocrText = await ocrPage(singlePageBuf, pageNum, documentName);
    if (ocrText.length > 0) {
      enhanced[idx] = ocrText;
      console.log(`   OCR page ${pageNum}: ${ocrText.length} chars extracted`);
    } else {
      console.log(`   OCR page ${pageNum}: no text found`);
    }
  }
  return enhanced;
}

// --- Main ---
async function main() {
  console.log("=== NDMO Knowledge Base Setup ===\n");
  if (WITH_OCR) {
    console.log("OCR mode enabled (default): image-based pages will be processed via OpenAI Vision.\n");
  } else {
    console.log("OCR mode disabled (--no-ocr): image-based pages will be skipped.\n");
  }

  console.log(`Found ${PDF_FILES.length} PDF files in ${PDF_DIR}/:`);
  for (const pdfFile of PDF_FILES) {
    const pdfPath = resolve(process.cwd(), PDF_DIR, pdfFile);
    if (!existsSync(pdfPath)) {
      console.error(`ERROR: ${pdfFile} not found in ${PDF_DIR}/.`);
      console.error(`  Expected at: ${pdfPath}`);
      process.exit(1);
    }
    console.log(`  - ${pdfFile}`);
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
  let skippedCount = 0;
  for (const pdfFile of PDF_FILES) {
    const pdfPath = resolve(process.cwd(), PDF_DIR, pdfFile);
    const pdfBuffer = readFileSync(pdfPath);
    const fileHash = computeFileHash(pdfBuffer);

    // Check if already processed
    if (!FORCE) {
      const existing = isAlreadyProcessed(fileHash);
      if (existing) {
        console.log(`\n⏭️  Skipping ${pdfFile} (already processed as "${existing.filename}")`);
        skippedCount++;
        continue;
      }
    }
    
    // Extract pages
    const { pageTexts, totalPages } = await extractPages(pdfPath);
    
    // OCR enhancement for image-based pages
    let finalPageTexts = pageTexts;
    if (WITH_OCR) {
      const pdfBuffer = readFileSync(pdfPath);
      finalPageTexts = await enhanceWithOCR(pdfBuffer, pageTexts, pdfFile);
    }
    
    // Format with markers
    const formattedContent = formatPages(pdfFile, finalPageTexts);
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
      // Track the file
      markProcessed({
        filename: pdfFile,
        hash: fileHash,
        openaiFileId: fileResponse.id,
        vectorStoreId,
        pageCount: totalPages,
        processedAt: new Date().toISOString(),
      });
    } else {
      console.error(`   ❌ Indexing failed with status: ${status}`);
    }
  }

  // Done
  console.log("\n=== Setup Complete ===\n");
  if (skippedCount > 0) {
    console.log(`Skipped ${skippedCount} already-processed file(s). Use --force to re-process.\n`);
  }
  console.log("Add this to your .env.local:\n");
  console.log(`OPENAI_VECTOR_STORE_ID=${vectorStoreId}`);
  console.log("\nThen run: npm run dev");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
