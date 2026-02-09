import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { UploadedFile } from "@/types";

const FILE_PATH = path.join(process.cwd(), "uploaded-files.json");

/**
 * Read the list of uploaded files from the JSON persistence file.
 */
export async function getUploadedFiles(): Promise<UploadedFile[]> {
  try {
    if (!existsSync(FILE_PATH)) {
      return [];
    }
    const data = await readFile(FILE_PATH, "utf-8");
    return JSON.parse(data) as UploadedFile[];
  } catch {
    return [];
  }
}

/**
 * Add a new uploaded file to the persistence list.
 */
export async function addUploadedFile(file: UploadedFile): Promise<void> {
  const files = await getUploadedFiles();
  files.push(file);
  await writeFile(FILE_PATH, JSON.stringify(files, null, 2), "utf-8");
}

/**
 * Get the count of uploaded files.
 */
export async function getUploadedFileCount(): Promise<number> {
  const files = await getUploadedFiles();
  return files.length;
}
