import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import { filterInput } from "@/lib/content-filter";

const DATA_DIR = resolve(process.cwd(), "data");
const NOTES_FILE = resolve(DATA_DIR, "notes.json");

interface Note {
  id: string;
  sessionId: string;
  content: string;
  timestamp: string;
  locale: string;
}

function loadNotes(): { notes: Note[] } {
  if (!existsSync(NOTES_FILE)) return { notes: [] };
  try {
    return JSON.parse(readFileSync(NOTES_FILE, "utf-8"));
  } catch {
    return { notes: [] };
  }
}

function saveNotes(data: { notes: Note[] }) {
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

    // Content filter
    const filterResult = filterInput(content);
    if (filterResult.blocked) {
      return NextResponse.json(
        { error: "content_blocked" },
        { status: 400 }
      );
    }

    const data = loadNotes();
    const note: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId: sessionId || "unknown",
      content: content.trim().slice(0, 1000), // Limit to 1000 chars
      timestamp: new Date().toISOString(),
      locale: locale || "en",
    };
    data.notes.push(note);

    // Keep last 200 notes
    if (data.notes.length > 200) {
      data.notes = data.notes.slice(-200);
    }

    saveNotes(data);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
