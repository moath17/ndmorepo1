import { NextRequest, NextResponse } from "next/server";
import {
  syncFilesFromVectorStore,
  toggleFile,
  uploadFile,
  getFilesWithConfig,
  updateFileDisplayName,
  removeNonAllowedFilesFromVectorStore,
  cleanPublicPdfs,
} from "@/lib/file-manager";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ndmo2024";

// Simple token verification (same as main admin route)
function generateToken(pw: string): string {
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    const chr = pw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `admin_${Math.abs(hash).toString(36)}_${pw.length}`;
}

const ADMIN_TOKEN = generateToken(ADMIN_PASSWORD);

function verifyAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === ADMIN_TOKEN;
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type") || "";

    // Handle file upload (multipart form data)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const displayName = formData.get("displayName") as string | null;

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      if (!file.name.toLowerCase().endsWith(".pdf")) {
        return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
      }

      // Max 50MB
      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await uploadFile(buffer, file.name, displayName || undefined);

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, file: result.file });
    }

    // Handle JSON actions
    let body: { action?: string; [k: string]: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid or missing JSON body" },
        { status: 400 }
      );
    }
    const { action } = body;

    if (action === "sync") {
      // Sync files from vector store
      const files = await syncFilesFromVectorStore();
      return NextResponse.json({ success: true, files });
    }

    if (action === "toggle") {
      const { filename, enabled } = body;
      if (!filename || typeof enabled !== "boolean") {
        return NextResponse.json({ error: "Missing filename or enabled" }, { status: 400 });
      }
      const result = await toggleFile(filename, enabled);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "list") {
      const files = getFilesWithConfig();
      return NextResponse.json({ success: true, files });
    }

    if (action === "updateDisplayName") {
      const { filename, displayName } = body;
      if (!filename || typeof displayName !== "string") {
        return NextResponse.json({ error: "Missing filename or displayName" }, { status: 400 });
      }
      const result = updateFileDisplayName(filename, displayName);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, files: getFilesWithConfig() });
    }

    if (action === "clean") {
      const vsResult = await removeNonAllowedFilesFromVectorStore();
      const pdfResult = cleanPublicPdfs();
      if (!vsResult.success) {
        return NextResponse.json(
          { success: false, error: vsResult.error, removedFromStore: vsResult.removed, removedFromPublic: pdfResult.removed },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        removedFromStore: vsResult.removed,
        removedFromPublic: pdfResult.removed,
        files: getFilesWithConfig(),
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
