import { NextResponse } from "next/server";
import { getUploadedFiles } from "@/lib/uploaded-files";

export async function GET() {
  try {
    const files = await getUploadedFiles();
    return NextResponse.json({ files });
  } catch {
    return NextResponse.json({ files: [] }, { status: 500 });
  }
}
