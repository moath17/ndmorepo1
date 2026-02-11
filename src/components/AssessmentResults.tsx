"use client";

import { useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
} from "recharts";
import { RotateCcw, AlertTriangle, CheckCircle, MinusCircle, Download } from "lucide-react";
import { exportAssessmentPDF } from "@/lib/pdf-export";
import type { Dictionary, Locale } from "@/types";

interface QuestionAnswer {
  questionId: string;
  categoryId: string;
  answer: "yes" | "partial" | "no" | null;
}

interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
  domainId?: string;
  questions: Array<{ id: string; questionAr: string; questionEn: string }>;
}

// Short names for chart labels to avoid overlapping
const SHORT_NAMES_AR: Record<string, string> = {
  "data-governance": "حوكمة البيانات",
  "data-catalog": "فهرس البيانات",
  "data-quality": "جودة البيانات",
  "data-operations": "عمليات البيانات",
  "document-content": "إدارة الوثائق",
  "data-architecture": "هيكلة البيانات",
  "reference-master-data": "البيانات المرجعية",
  "bi-analytics": "ذكاء الأعمال",
  "data-sharing": "مشاركة البيانات",
  "data-value": "تحقيق القيمة",
  "open-data": "البيانات المفتوحة",
  "freedom-info": "حرية المعلومات",
  "data-classification": "تصنيف البيانات",
  "personal-data": "حماية البيانات",
};

const SHORT_NAMES_EN: Record<string, string> = {
  "data-governance": "Governance",
  "data-catalog": "Catalog",
  "data-quality": "Quality",
  "data-operations": "Operations",
  "document-content": "Documents",
  "data-architecture": "Architecture",
  "reference-master-data": "Master Data",
  "bi-analytics": "BI & Analytics",
  "data-sharing": "Data Sharing",
  "data-value": "Data Value",
  "open-data": "Open Data",
  "freedom-info": "Info Freedom",
  "data-classification": "Classification",
  "personal-data": "Personal Data",
};

interface AssessmentResultsProps {
  answers: QuestionAnswer[];
  categories: Category[];
  dict: Dictionary;
  locale: Locale;
  onRestart: () => void;
}

export default function AssessmentResults({
  answers,
  categories,
  dict,
  locale,
  onRestart,
}: AssessmentResultsProps) {
  const isAr = locale === "ar";

  // Calculate scores per category
  const categoryScores = categories.map((cat) => {
    const catAnswers = answers.filter((a) => a.categoryId === cat.id);
    const total = catAnswers.length;
    const yesCount = catAnswers.filter((a) => a.answer === "yes").length;
    const partialCount = catAnswers.filter((a) => a.answer === "partial").length;
    const score = total > 0 ? Math.round(((yesCount + partialCount * 0.5) / total) * 100) : 0;

    return {
      id: cat.id,
      name: isAr ? cat.nameAr : cat.nameEn,
      score,
      yesCount,
      partialCount,
      noCount: total - yesCount - partialCount,
      total,
    };
  });

  // Overall score
  const totalQuestions = answers.length;
  const totalYes = answers.filter((a) => a.answer === "yes").length;
  const totalPartial = answers.filter((a) => a.answer === "partial").length;
  const totalNo = answers.filter((a) => a.answer === "no").length;
  const overallScore = totalQuestions > 0
    ? Math.round(((totalYes + totalPartial * 0.5) / totalQuestions) * 100)
    : 0;

  // Determine compliance level
  let complianceLevel: "high" | "medium" | "low";
  let complianceColor: string;
  let complianceIcon: typeof CheckCircle;
  let recommendation: string;

  if (overallScore >= 75) {
    complianceLevel = "high";
    complianceColor = "text-emerald-600";
    complianceIcon = CheckCircle;
    recommendation = dict.assessment.highCompliance;
  } else if (overallScore >= 40) {
    complianceLevel = "medium";
    complianceColor = "text-amber-600";
    complianceIcon = MinusCircle;
    recommendation = dict.assessment.mediumCompliance;
  } else {
    complianceLevel = "low";
    complianceColor = "text-red-600";
    complianceIcon = AlertTriangle;
    recommendation = dict.assessment.lowCompliance;
  }

  const ComplianceIcon = complianceIcon;

  // Save assessment results to backend (once)
  const savedRef = useRef(false);
  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;

    const userName =
      typeof window !== "undefined"
        ? localStorage.getItem("ndmo-user-name") || "Guest"
        : "Guest";

    fetch("/api/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save",
        userName,
        locale,
        overallScore,
        categoryScores: categoryScores.map((cs) => ({
          id: cs.id,
          name: cs.name,
          score: cs.score,
        })),
        totalQuestions,
        answeredYes: totalYes,
        answeredPartial: totalPartial,
        answeredNo: totalNo,
      }),
    }).catch(() => {
      // Silently fail — non-critical
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Use short names for charts to prevent overlap
  const shortNames = isAr ? SHORT_NAMES_AR : SHORT_NAMES_EN;

  const barData = categoryScores.map((cs) => ({
    name: shortNames[cs.id] || cs.name,
    score: cs.score,
    fill:
      cs.score >= 75 ? "#059669" : cs.score >= 40 ? "#d97706" : "#dc2626",
  }));

  const radarData = categoryScores.map((cs) => ({
    subject: shortNames[cs.id] || cs.name,
    score: cs.score,
    fullMark: 100,
  }));

  // Category details for the details section
  const categoryDetails = categoryScores.filter((cs) => cs.total > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 px-1">
      {/* Overall Score */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm text-center">
        <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">
          {dict.assessment.overallScore}
        </h2>
        <div className="relative inline-flex items-center justify-center">
          <svg className="w-32 h-32 sm:w-40 sm:h-40" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke={
                overallScore >= 75
                  ? "#059669"
                  : overallScore >= 40
                    ? "#d97706"
                    : "#dc2626"
              }
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(overallScore / 100) * 314} 314`}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="absolute text-center">
            <span className={`text-2xl sm:text-3xl font-bold ${complianceColor}`}>
              {overallScore}%
            </span>
          </div>
        </div>
        <div className="mt-3 sm:mt-4 flex items-center justify-center gap-2">
          <ComplianceIcon className={`w-5 h-5 ${complianceColor}`} />
          <span className={`text-sm font-medium ${complianceColor}`}>
            {complianceLevel === "high"
              ? dict.assessment.compliant
              : complianceLevel === "medium"
                ? dict.assessment.partiallyCompliant
                : dict.assessment.nonCompliant}
          </span>
        </div>

        {/* Quick stats */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 mt-3 sm:mt-4 text-xs sm:text-sm">
          <span className="text-emerald-600">
            {dict.assessment.yes}: {totalYes}
          </span>
          <span className="text-amber-600">
            {dict.assessment.partial}: {totalPartial}
          </span>
          <span className="text-red-600">
            {dict.assessment.no}: {totalNo}
          </span>
        </div>
      </div>

      {/* Recommendation */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          {dict.assessment.recommendation}
        </h3>
        <p className="text-sm text-gray-600 leading-relaxed">{recommendation}</p>
      </div>

      {/* Category Details Grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          {dict.chat.detailsByCategory}
        </h3>
        <div className="space-y-3">
          {categoryDetails.map((cs) => (
            <div key={cs.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                    {cs.name}
                  </span>
                  <span className={`text-xs font-bold flex-shrink-0 ms-2 ${
                    cs.score >= 75 ? "text-emerald-600" : cs.score >= 40 ? "text-amber-600" : "text-red-600"
                  }`}>
                    {cs.score}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      cs.score >= 75 ? "bg-emerald-500" : cs.score >= 40 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${cs.score}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 sm:mb-4">
            {dict.assessment.categoryScore}
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(300, categoryScores.length * 34)}>
            <BarChart data={barData} layout="vertical" margin={{ left: 5, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                width={130}
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                formatter={(value) => [`${value}%`, dict.chat.score]}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 sm:mb-4">
            {dict.chat.complianceRadar}
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9 }} />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fontSize: 9 }}
              />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#2563eb"
                fill="#2563eb"
                fillOpacity={0.3}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 pb-4">
        <button
          onClick={() => {
            exportAssessmentPDF({
              title: dict.assessment.title,
              subtitle: dict.assessment.subtitle,
              overallScore,
              complianceLevel:
                complianceLevel === "high"
                  ? dict.assessment.compliant
                  : complianceLevel === "medium"
                    ? dict.assessment.partiallyCompliant
                    : dict.assessment.nonCompliant,
              recommendation,
              categoryScores,
              labels: {
                yes: dict.assessment.yes,
                partial: dict.assessment.partial,
                no: dict.assessment.no,
                score: dict.chat.score,
                category: dict.assessment.categoryScore,
                recommendation: dict.assessment.recommendation,
                overallScore: dict.assessment.overallScore,
                generatedAt: isAr ? "تم الإنشاء في" : "Generated at",  // Keep as-is for PDF
                compliant: dict.assessment.compliant,
                partiallyCompliant: dict.assessment.partiallyCompliant,
                nonCompliant: dict.assessment.nonCompliant,
                exportTitle: dict.chat.detailsByCategory,
              },
              isRTL: isAr,
            });
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          {dict.assessment.exportResults}
        </button>
        <button
          onClick={onRestart}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          {dict.assessment.restart}
        </button>
      </div>
    </div>
  );
}

