import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

const DATA_DIR = resolve(process.cwd(), "data");
const ASSESSMENTS_FILE = resolve(DATA_DIR, "assessments.json");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

interface AssessmentRecord {
  id: string;
  userName: string;
  locale: string;
  overallScore: number;
  categoryScores: { id: string; name: string; score: number }[];
  totalQuestions: number;
  answeredYes: number;
  answeredPartial: number;
  answeredNo: number;
  timestamp: string;
}

function loadAssessments(): { assessments: AssessmentRecord[] } {
  if (!existsSync(ASSESSMENTS_FILE)) return { assessments: [] };
  try {
    return JSON.parse(readFileSync(ASSESSMENTS_FILE, "utf-8"));
  } catch {
    return { assessments: [] };
  }
}

function saveAssessments(data: { assessments: AssessmentRecord[] }) {
  ensureDataDir();
  writeFileSync(ASSESSMENTS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "save") {
      const {
        userName,
        locale,
        overallScore,
        categoryScores,
        totalQuestions,
        answeredYes,
        answeredPartial,
        answeredNo,
      } = body;

      const data = loadAssessments();

      const record: AssessmentRecord = {
        id: `asmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userName: userName || "Guest",
        locale: locale || "ar",
        overallScore: overallScore || 0,
        categoryScores: categoryScores || [],
        totalQuestions: totalQuestions || 0,
        answeredYes: answeredYes || 0,
        answeredPartial: answeredPartial || 0,
        answeredNo: answeredNo || 0,
        timestamp: new Date().toISOString(),
      };

      data.assessments.push(record);

      // Keep only last 200 assessments
      if (data.assessments.length > 200) {
        data.assessments = data.assessments.slice(-200);
      }

      saveAssessments(data);

      return NextResponse.json({ success: true, id: record.id });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
