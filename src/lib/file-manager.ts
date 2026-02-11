/**
 * File manager for admin panel.
 * Tracks which files are enabled/disabled in the vector store.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "fs";
import { resolve } from "path";
import { getOpenAIClient, getVectorStoreId } from "./openai";

const DATA_DIR = resolve(process.cwd(), "data");
const CONFIG_FILE = resolve(DATA_DIR, "files-config.json");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export interface FileConfig {
  /** Original filename */
  filename: string;
  /** Display name */
  displayName: string;
  /** OpenAI file ID in the vector store */
  openaiFileId?: string;
  /** Whether this file is active (searched by chat) */
  enabled: boolean;
  /** When the file was added */
  addedAt: string;
  /** Page count if known */
  pageCount?: number;
  /** Language */
  language?: string;
}

interface FilesConfigData {
  files: FileConfig[];
}

export function loadFilesConfig(): FilesConfigData {
  if (!existsSync(CONFIG_FILE)) return { files: [] };
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return { files: [] };
  }
}

function saveFilesConfig(data: FilesConfigData) {
  ensureDataDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Initialize file config from the current vector store.
 * Lists all files in the vector store and creates config entries.
 */
export async function syncFilesFromVectorStore(): Promise<FileConfig[]> {
  const vectorStoreId = getVectorStoreId();
  if (!vectorStoreId) return [];

  const client = getOpenAIClient();
  const data = loadFilesConfig();

  try {
    // List all files in the vector store
    const vsFiles = await client.vectorStores.files.list(vectorStoreId);
    const vsFileIds = new Set<string>();

    for (const vsFile of vsFiles.data) {
      vsFileIds.add(vsFile.id);

      // Check if we already track this file
      const existing = data.files.find((f) => f.openaiFileId === vsFile.id);
      if (existing) continue;

      // Get file details
      try {
        const fileDetail = await client.files.retrieve(vsFile.id);
        data.files.push({
          filename: fileDetail.filename || vsFile.id,
          displayName: (fileDetail.filename || vsFile.id).replace(/\.(pdf|txt)$/i, ""),
          openaiFileId: vsFile.id,
          enabled: true,
          addedAt: new Date().toISOString(),
        });
      } catch {
        data.files.push({
          filename: vsFile.id,
          displayName: vsFile.id,
          openaiFileId: vsFile.id,
          enabled: true,
          addedAt: new Date().toISOString(),
        });
      }
    }

    saveFilesConfig(data);
    return data.files;
  } catch (err) {
    console.error("Error syncing vector store files:", err);
    return data.files;
  }
}

/**
 * Toggle a file's enabled state.
 * When disabling: removes from vector store.
 * When enabling: re-adds to vector store.
 */
export async function toggleFile(
  filename: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  const vectorStoreId = getVectorStoreId();
  if (!vectorStoreId) return { success: false, error: "No vector store configured" };

  const client = getOpenAIClient();
  const data = loadFilesConfig();
  const file = data.files.find((f) => f.filename === filename);

  if (!file) return { success: false, error: "File not found" };
  if (file.enabled === enabled) return { success: true };

  try {
    if (!enabled && file.openaiFileId) {
      // Disable: remove from vector store (but keep the OpenAI file)
      try {
        await client.vectorStores.files.del(vectorStoreId, file.openaiFileId);
      } catch {
        // May already be removed
      }
      file.enabled = false;
    } else if (enabled && file.openaiFileId) {
      // Enable: re-add to vector store
      await client.vectorStores.files.create(vectorStoreId, {
        file_id: file.openaiFileId,
      });
      file.enabled = true;
    }

    saveFilesConfig(data);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

/**
 * Upload a new PDF file to OpenAI and add to vector store.
 */
export async function uploadFile(
  fileBuffer: Buffer,
  originalFilename: string,
  displayName?: string
): Promise<{ success: boolean; error?: string; file?: FileConfig }> {
  const vectorStoreId = getVectorStoreId();
  if (!vectorStoreId) return { success: false, error: "No vector store configured" };

  const client = getOpenAIClient();
  const data = loadFilesConfig();

  // Check if file already exists
  if (data.files.some((f) => f.filename === originalFilename)) {
    return { success: false, error: "File already exists" };
  }

  try {
    // Upload to OpenAI
    const uint8 = new Uint8Array(fileBuffer);
    const blob = new Blob([uint8], { type: "application/pdf" });
    const file = new File([blob], originalFilename, { type: "application/pdf" });

    const fileResponse = await client.files.create({
      file: file,
      purpose: "assistants",
    });

    // Add to vector store
    await client.vectorStores.files.create(vectorStoreId, {
      file_id: fileResponse.id,
    });

    // Copy to public/pdfs for direct access
    const publicPdfsDir = resolve(process.cwd(), "public", "pdfs");
    if (!existsSync(publicPdfsDir)) mkdirSync(publicPdfsDir, { recursive: true });
    const destPath = resolve(publicPdfsDir, originalFilename);
    writeFileSync(destPath, fileBuffer);

    // Track in config
    const newFile: FileConfig = {
      filename: originalFilename,
      displayName: displayName || originalFilename.replace(/\.(pdf|txt)$/i, ""),
      openaiFileId: fileResponse.id,
      enabled: true,
      addedAt: new Date().toISOString(),
    };

    data.files.push(newFile);
    saveFilesConfig(data);

    return { success: true, file: newFile };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    return { success: false, error: msg };
  }
}

/**
 * Get the list of all tracked files with their config.
 */
export function getFilesWithConfig(): FileConfig[] {
  return loadFilesConfig().files;
}
