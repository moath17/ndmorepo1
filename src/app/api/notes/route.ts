import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import { filterInput } from "@/lib/content-filter";
import {
  getNotesFromStore,
  appendNoteToStore,
  isNotesStoreAvailable,
  type StoredNote,
} from "@/lib/notes-store";

const DATA_DIR = resolve(process.cwd(), "data");
const NOTES_FILE = resolve(DATA_DIR, "notes.json");

function loadNotesFromFile(): { notes: StoredNote[] } {
  if (!existsSync(NOTES_FILE)) return { notes: [] };
  try {
    return JSON.parse(readFileSync(NOTES_FILE, "utf-8"));
  } catch {
    return { notes: [] };
  }
}

function saveNotesToFile(data: { notes: StoredNote[] }) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(NOTES_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, sessionId, locale } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const filterResult = filterInput(content);
    if (filterResult.blocked) {
      return NextResponse.json(
        { error: "content_blocked" },
        { status: 400 }
      );
    }

    const note: StoredNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId: sessionId || "unknown",
      content: content.trim().slice(0, 1000),
      timestamp: new Date().toISOString(),
      locale: locale || "en",
    };

    if (isNotesStoreAvailable()) {
      const ok = await appendNoteToStore(note);
      if (!ok) {
        return NextResponse.json(
          { error: "Failed to save note" },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true });
    }

    const data = loadNotesFromFile();
    data.notes.push(note);
    if (data.notes.length > 200) {
      data.notes = data.notes.slice(-200);
    }
    try {
      saveNotesToFile(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("EROFS") || msg.includes("read-only")) {
        return NextResponse.json(
          {
            error:
              "Notes storage is not configured for this environment. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production.",
          },
          { status: 503 }
        );
      }
      throw err;
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
