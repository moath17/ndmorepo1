import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limiter";
import { sanitizeFilename, generateId } from "@/lib/sanitize";
import { extractPagesFromPDF, formatPagesForVectorStore } from "@/lib/pdf-processor";
import { ensureVectorStore, uploadToVectorStore } from "@/lib/vector-store";
import { addUploadedFile } from "@/lib/uploaded-files";
import type { UploadedFile, UploadResponse } from "@/types";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILES_PER_REQUEST = 10;
const ALLOWED_TYPES = ["application/pdf"];

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIP(request);
    const rateCheck = checkRateLimit(ip, "upload");
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          files: [],
          error: "Rate limit exceeded. Please wait before uploading again.",
        } satisfies UploadResponse,
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)
            ),
          },
        }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          files: [],
          error: "No files provided.",
        } satisfies UploadResponse,
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        {
          success: false,
          files: [],
          error: `Maximum ${MAX_FILES_PER_REQUEST} files per upload.`,
        } satisfies UploadResponse,
        { status: 400 }
      );
    }

    // Ensure vector store exists
    const vectorStoreId = await ensureVectorStore();

    const uploadedFiles: UploadedFile[] = [];
    const errors: string[] = [];

    for (const fileEntry of files) {
      if (!(fileEntry instanceof File)) {
        errors.push("Invalid file entry.");
        continue;
      }

      const file = fileEntry as File;

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Only PDF files are accepted.`);
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large (max 100MB).`);
        continue;
      }

      try {
        // Read file buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Sanitize filename
        const sanitizedName = sanitizeFilename(file.name);

        // Extract pages from PDF
        const pages = await extractPagesFromPDF(buffer);

        if (pages.length === 0) {
          errors.push(`${file.name}: Could not extract text from PDF.`);
          continue;
        }

        // Format for vector store with page markers
        const formattedContent = formatPagesForVectorStore(
          sanitizedName,
          pages
        );

        // Upload to OpenAI vector store
        const openaiFileId = await uploadToVectorStore(
          sanitizedName,
          formattedContent,
          vectorStoreId
        );

        // Create file record
        const uploadedFile: UploadedFile = {
          id: generateId(),
          originalName: file.name,
          sanitizedName,
          openaiFileId,
          pageCount: pages.length,
          uploadedAt: new Date().toISOString(),
        };

        // Persist file record
        await addUploadedFile(uploadedFile);
        uploadedFiles.push(uploadedFile);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        errors.push(`${file.name}: ${message}`);
      }
    }

    const response: UploadResponse = {
      success: uploadedFiles.length > 0,
      files: uploadedFiles,
      error: errors.length > 0 ? errors.join("; ") : undefined,
    };

    return NextResponse.json(response, {
      status: uploadedFiles.length > 0 ? 200 : 400,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      {
        success: false,
        files: [],
        error: message,
      } satisfies UploadResponse,
      { status: 500 }
    );
  }
}
