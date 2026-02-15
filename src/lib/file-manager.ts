/**
 * File manager for admin panel.
 * Tracks which files are enabled/disabled in the vector store.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, unlinkSync, statSync } from "fs";
import { resolve, join } from "path";
import { getOpenAIClient, getVectorStoreId } from "./openai";

const DATA_DIR = resolve(process.cwd(), "data");
const CONFIG_FILE = resolve(DATA_DIR, "files-config.json");

/** Only these files are shown and used (Arabic + English). Add more later if needed. */
const ALLOWED_FILENAMES = new Set([
  "Policies001.pdf",
  "Policies001.txt",
  "PoliciesEn001.pdf",
  "PoliciesEn001.txt",
]);

function isAllowedFilename(filename: string): boolean {
  return ALLOWED_FILENAMES.has(filename);
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export interface FileConfig {
  /** Original filename */
  filename: string;
  /** Display name */
  displayName: string;
  /** OpenAI file ID (for create when re-enabling) */
  openaiFileId?: string;
  /** Vector store file ID (for delete when disabling) */
  vectorStoreFileId?: string;
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
      const vsId = (vsFile as { id: string }).id;
      const fId = (vsFile as { file_id?: string }).file_id ?? vsId;
      vsFileIds.add(vsId);

      const existing = data.files.find(
        (f) => f.openaiFileId === fId || f.vectorStoreFileId === vsId
      );
      if (existing) {
        existing.vectorStoreFileId = vsId;
        existing.openaiFileId = fId;
        continue;
      }

      try {
        const fileDetail = await client.files.retrieve(fId);
        const name = (fileDetail as { filename?: string }).filename || fId;
        if (!isAllowedFilename(name)) continue;
        data.files.push({
          filename: name,
          displayName: name.replace(/\.(pdf|txt)$/i, ""),
          openaiFileId: fId,
          vectorStoreFileId: vsId,
          enabled: true,
          addedAt: new Date().toISOString(),
        });
      } catch {
        continue;
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
    if (!enabled && (file.vectorStoreFileId || file.openaiFileId)) {
      const idToDelete = file.vectorStoreFileId ?? file.openaiFileId;
      try {
        await client.vectorStores.files.del(vectorStoreId, idToDelete!);
      } catch {
        // May already be removed
      }
      file.enabled = false;
    } else if (enabled && file.openaiFileId) {
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

    const vsFile = await client.vectorStores.files.create(vectorStoreId, {
      file_id: fileResponse.id,
    });

    // Copy to public/pdfs for direct access
    const publicPdfsDir = resolve(process.cwd(), "public", "pdfs");
    if (!existsSync(publicPdfsDir)) mkdirSync(publicPdfsDir, { recursive: true });
    const destPath = resolve(publicPdfsDir, originalFilename);
    writeFileSync(destPath, fileBuffer);

    const vsFileId = (vsFile as { id: string }).id;
    const newFile: FileConfig = {
      filename: originalFilename,
      displayName: displayName || originalFilename.replace(/\.(pdf|txt)$/i, ""),
      openaiFileId: fileResponse.id,
      vectorStoreFileId: vsFileId,
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
 * Update display name for a file.
 */
export function updateFileDisplayName(
  filename: string,
  displayName: string
): { success: boolean; error?: string } {
  const data = loadFilesConfig();
  const file = data.files.find((f) => f.filename === filename);
  if (!file) return { success: false, error: "File not found" };
  file.displayName = displayName.trim() || file.filename.replace(/\.(pdf|txt)$/i, "");
  saveFilesConfig(data);
  return { success: true };
}

/**
 * Remove from the vector store all files that are NOT in the allowed list.
 * Also updates files-config.json to only keep allowed files.
 * Call this so the chat uses only Policies001 and PoliciesEn001.
 */
export async function removeNonAllowedFilesFromVectorStore(): Promise<{
  success: boolean;
  removed: number;
  error?: string;
}> {
  const vectorStoreId = getVectorStoreId();
  if (!vectorStoreId) return { success: false, removed: 0, error: "No vector store configured" };

  const client = getOpenAIClient();
  const data = loadFilesConfig();
  let removed = 0;

  try {
    const vsFiles = await client.vectorStores.files.list(vectorStoreId);
    const vsList = vsFiles.data ?? [];

    for (const vsFile of vsList) {
      const vsFileId = (vsFile as { id: string }).id;
      const openaiFileId = (vsFile as { file_id?: string }).file_id ?? vsFileId;

      let filename: string;
      try {
        const fileDetail = await client.files.retrieve(openaiFileId);
        filename = (fileDetail as { filename?: string }).filename || openaiFileId;
      } catch {
        filename = openaiFileId;
      }

      if (!isAllowedFilename(filename)) {
        try {
          await client.vectorStores.files.del(vectorStoreId, vsFileId);
          removed++;
        } catch {
          // continue
        }
      }
    }

    data.files = data.files.filter((f) => isAllowedFilename(f.filename));
    saveFilesConfig(data);
    return { success: true, removed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, removed: 0, error: msg };
  }
}

/**
 * Remove from public/pdfs any file that is not in the allowed list (Policies001.pdf, PoliciesEn001.pdf).
 */
export function cleanPublicPdfs(): { success: boolean; removed: number; error?: string } {
  const dir = resolve(process.cwd(), "public", "pdfs");
  if (!existsSync(dir)) return { success: true, removed: 0 };
  let removed = 0;
  try {
    const names = readdirSync(dir);
    for (const name of names) {
      const fullPath = join(dir, name);
      if (!existsSync(fullPath) || isAllowedFilename(name)) continue;
      try {
        if (statSync(fullPath).isFile()) {
          unlinkSync(fullPath);
          removed++;
        }
      } catch {
        // skip
      }
    }
    return { success: true, removed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, removed: 0, error: msg };
  }
}

/**
 * Get the list of all tracked files with their config (only allowed files).
 */
export function getFilesWithConfig(): FileConfig[] {
  return loadFilesConfig().files.filter((f) => isAllowedFilename(f.filename));
}
