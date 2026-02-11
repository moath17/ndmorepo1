import { NextRequest, NextResponse } from "next/server";
import { getAllInteractions, getAnalytics } from "@/lib/learning";
import { getAllSessions } from "@/lib/session";
import { readFileSync, existsSync, statSync, readdirSync } from "fs";
import { resolve, extname } from "path";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Majid@123";
const DATA_DIR = resolve(process.cwd(), "data");

// Simple token: hash the password to avoid sending raw password as bearer token
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

function verifyPassword(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  const token = authHeader.replace("Bearer ", "");
  return token === ADMIN_TOKEN;
}

function loadNotes() {
  const notesFile = resolve(DATA_DIR, "notes.json");
  if (!existsSync(notesFile)) return [];
  try {
    return JSON.parse(readFileSync(notesFile, "utf-8")).notes || [];
  } catch {
    return [];
  }
}

function loadAssessments() {
  const file = resolve(DATA_DIR, "assessments.json");
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, "utf-8")).assessments || [];
  } catch {
    return [];
  }
}

function loadProcessedFiles() {
  // Try processed-files.json first (created by setup script)
  const trackerFile = resolve(DATA_DIR, "processed-files.json");
  if (existsSync(trackerFile)) {
    try {
      const data = JSON.parse(readFileSync(trackerFile, "utf-8"));
      if (data.files && data.files.length > 0) {
        return data.files.map(
          (f: {
            filename: string;
            hash: string;
            processedAt: string;
            pageCount: number;
          }) => {
            const pdfPath = resolve(process.cwd(), "pdfs", f.filename);
            let fileDate = null;
            try {
              if (existsSync(pdfPath)) {
                const stat = statSync(pdfPath);
                fileDate = stat.mtime.toISOString();
              }
            } catch {
              // ignore
            }
            return {
              filename: f.filename,
              uploadDate: f.processedAt,
              fileDate,
              pageCount: f.pageCount,
              hash: f.hash?.slice(0, 12),
            };
          }
        );
      }
    } catch {
      // fall through to next method
    }
  }

  // Fallback: read from policies-structure.json (static data)
  const structureFile = resolve(
    process.cwd(),
    "src",
    "data",
    "policies-structure.json"
  );
  if (existsSync(structureFile)) {
    try {
      const structure = JSON.parse(readFileSync(structureFile, "utf-8"));
      const docs = structure.summary?.documents || [];
      return docs.map(
        (d: { name: string; file: string; pages: number; language: string }) => {
          // Try to get file dates from pdfs/ or public/pdfs/
          let fileDate = null;
          let uploadDate = null;
          const paths = [
            resolve(process.cwd(), "pdfs", d.file),
            resolve(process.cwd(), "public", "pdfs", d.file),
          ];
          for (const p of paths) {
            try {
              if (existsSync(p)) {
                const stat = statSync(p);
                fileDate = stat.mtime.toISOString();
                uploadDate = stat.birthtime.toISOString();
                break;
              }
            } catch {
              // ignore
            }
          }
          return {
            filename: d.file,
            name: d.name,
            uploadDate,
            fileDate,
            pageCount: d.pages,
            language: d.language,
            hash: null,
          };
        }
      );
    } catch {
      // fall through
    }
  }

  // Last fallback: scan pdfs/ directory directly
  const pdfsDir = resolve(process.cwd(), "pdfs");
  if (existsSync(pdfsDir)) {
    try {
      const files = readdirSync(pdfsDir).filter(
        (f) => extname(f).toLowerCase() === ".pdf"
      );
      return files.map((f) => {
        const fullPath = resolve(pdfsDir, f);
        const stat = statSync(fullPath);
        return {
          filename: f,
          name: f.replace(".pdf", ""),
          uploadDate: stat.birthtime.toISOString(),
          fileDate: stat.mtime.toISOString(),
          pageCount: null,
          language: null,
          hash: null,
        };
      });
    } catch {
      // ignore
    }
  }

  return [];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, password } = body;

    // Login action
    if (action === "login") {
      if (password === ADMIN_PASSWORD) {
        return NextResponse.json({ success: true, token: ADMIN_TOKEN });
      }
      return NextResponse.json(
        { success: false, error: "wrong_password" },
        { status: 401 }
      );
    }

    // All other actions require auth
    if (!verifyPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (action === "dashboard") {
      const analytics = getAnalytics();
      const sessions = getAllSessions();
      const files = loadProcessedFiles();
      const notes = loadNotes();
      const interactions = getAllInteractions();
      const assessments = loadAssessments();

      const questions = interactions.map((i) => ({
        question: i.question,
        answer: i.answer.slice(0, 500),
        locale: i.locale,
        timestamp: i.timestamp,
        sessionId: i.sessionId,
        userName: i.userName,
        rating: i.rating,
      }));

      return NextResponse.json({
        analytics,
        sessions: sessions.slice(-100).reverse(),
        files,
        notes: notes.slice(-50).reverse(),
        questions: questions.slice(-200).reverse(),
        assessments: assessments.slice(-50).reverse(),
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
