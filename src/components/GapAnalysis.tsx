"use client";

import { useState } from "react";
import {
  CheckCircle,
  MinusCircle,
  XCircle,
  Circle,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";
import policiesData from "@/data/policies-structure.json";
import type { Dictionary, Locale, PolicyDomain } from "@/types";

interface GapAnalysisProps {
  dict: Dictionary;
  locale: Locale;
}

type ComplianceStatus = "compliant" | "partial" | "non-compliant" | null;

interface ControlAssessment {
  controlId: string;
  status: ComplianceStatus;
}

const STATUS_CONFIG = {
  compliant: {
    icon: CheckCircle,
    colorClass: "text-emerald-600 bg-emerald-50 border-emerald-200",
    barColor: "#059669",
  },
  partial: {
    icon: MinusCircle,
    colorClass: "text-amber-600 bg-amber-50 border-amber-200",
    barColor: "#d97706",
  },
  "non-compliant": {
    icon: XCircle,
    colorClass: "text-red-600 bg-red-50 border-red-200",
    barColor: "#dc2626",
  },
  null: {
    icon: Circle,
    colorClass: "text-gray-400 bg-gray-50 border-gray-200",
    barColor: "#9ca3af",
  },
};

export default function GapAnalysis({ dict, locale }: GapAnalysisProps) {
  const isAr = locale === "ar";
  const domains = policiesData.domains as PolicyDomain[];

  const [selectedDomain, setSelectedDomain] = useState<string>(
    domains[0]?.id || ""
  );
  const [assessments, setAssessments] = useState<
    Record<string, ControlAssessment>
  >({});
  const [expandedDim, setExpandedDim] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const domain = domains.find((d) => d.id === selectedDomain);

  const handleStatusChange = (
    controlId: string,
    status: ComplianceStatus
  ) => {
    setAssessments((prev) => ({
      ...prev,
      [controlId]: { controlId, status },
    }));
  };

  // Calculate scores
  const allControls =
    domain?.dimensions.flatMap((dim) => dim.controls) || [];
  const assessedControls = allControls.filter(
    (c) => assessments[c.id]?.status != null
  );
  const compliantCount = assessedControls.filter(
    (c) => assessments[c.id]?.status === "compliant"
  ).length;
  const partialCount = assessedControls.filter(
    (c) => assessments[c.id]?.status === "partial"
  ).length;
  const nonCompliantCount = assessedControls.filter(
    (c) => assessments[c.id]?.status === "non-compliant"
  ).length;

  const overallScore =
    assessedControls.length > 0
      ? Math.round(
          ((compliantCount + partialCount * 0.5) / assessedControls.length) *
            100
        )
      : 0;

  const gaps = allControls.filter(
    (c) =>
      assessments[c.id]?.status === "non-compliant" ||
      assessments[c.id]?.status === "partial"
  );

  const statusLabels: Record<string, string> = {
    compliant: dict.gapAnalysis.compliant,
    partial: dict.gapAnalysis.partial,
    "non-compliant": dict.gapAnalysis.nonCompliant,
  };

  if (showReport && domain) {
    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => setShowReport(false)}
          className="text-sm text-primary-600 hover:underline"
        >
          {isAr ? "← العودة" : "← Back"}
        </button>

        {/* Report Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {dict.gapAnalysis.gapReport}
          </h2>
          <p className="text-sm text-gray-500">
            {isAr ? domain.nameAr : domain.nameEn}
          </p>

          <div className="mt-6 inline-flex items-center justify-center">
            <div
              className={`w-28 h-28 rounded-full border-8 flex items-center justify-center ${
                overallScore >= 75
                  ? "border-emerald-500"
                  : overallScore >= 40
                    ? "border-amber-500"
                    : "border-red-500"
              }`}
            >
              <span
                className={`text-3xl font-bold ${
                  overallScore >= 75
                    ? "text-emerald-600"
                    : overallScore >= 40
                      ? "text-amber-600"
                      : "text-red-600"
                }`}
              >
                {overallScore}%
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            {dict.gapAnalysis.overallCompliance}
          </p>

          <div className="flex justify-center gap-6 mt-4 text-sm">
            <span className="text-emerald-600">
              {dict.gapAnalysis.compliant}: {compliantCount}
            </span>
            <span className="text-amber-600">
              {dict.gapAnalysis.partial}: {partialCount}
            </span>
            <span className="text-red-600">
              {dict.gapAnalysis.nonCompliant}: {nonCompliantCount}
            </span>
          </div>
        </div>

        {/* Gaps and Recommendations */}
        {gaps.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {isAr ? "الفجوات والتوصيات" : "Gaps & Recommendations"}
            </h3>
            <div className="space-y-4">
              {gaps.map((control) => {
                const status = assessments[control.id]?.status;
                const cfg =
                  STATUS_CONFIG[status || "null"];
                const Icon = cfg.icon;
                return (
                  <div
                    key={control.id}
                    className={`border rounded-xl p-4 ${cfg.colorClass}`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-800">
                          {isAr ? control.nameAr : control.nameEn}
                        </h4>
                        <p className="text-xs mt-1">
                          {statusLabels[status || ""]}{" "}
                          &middot; {control.specs.length}{" "}
                          {dict.gapAnalysis.specs}
                        </p>
                        <div className="mt-3 text-sm text-gray-700">
                          <p className="font-medium mb-1">
                            {dict.gapAnalysis.recommendation}:
                          </p>
                          <p>
                            {status === "non-compliant"
                              ? isAr
                                ? `يجب تطوير وتنفيذ "${isAr ? control.nameAr : control.nameEn}" بشكل عاجل وفقاً لمتطلبات NDMO.`
                                : `Urgently develop and implement "${control.nameEn}" according to NDMO requirements.`
                              : isAr
                                ? `يجب استكمال تطبيق "${isAr ? control.nameAr : control.nameEn}" لتحقيق الامتثال الكامل.`
                                : `Complete the implementation of "${control.nameEn}" for full compliance.`}
                          </p>
                        </div>
                        {control.specs.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-500 mb-1">
                              {dict.gapAnalysis.specs}:
                            </p>
                            <ul className="text-xs text-gray-600 space-y-0.5">
                              {control.specs.map((spec, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <span className="mt-1">•</span>
                                  <span>{spec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {gaps.length === 0 && assessedControls.length > 0 && (
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-6 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <p className="text-emerald-700 font-medium">
              {isAr
                ? "جميع الضوابط ممتثلة بالكامل!"
                : "All controls are fully compliant!"}
            </p>
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            {isAr ? "طباعة / تحميل" : "Print / Download"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Domain Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          {dict.gapAnalysis.selectDomain}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {domains.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setSelectedDomain(d.id);
                setExpandedDim(null);
              }}
              className={`px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                selectedDomain === d.id
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div>{isAr ? d.nameAr : d.nameEn}</div>
              <div className="text-[10px] text-gray-400 mt-1">
                {d.controlCount} {dict.gapAnalysis.controls}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Controls Assessment */}
      {domain && (
        <div className="space-y-4">
          {domain.dimensions.map((dim) => {
            const isExpanded = expandedDim === dim.id || expandedDim === null;
            return (
              <div
                key={dim.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedDim((prev) =>
                      prev === dim.id ? null : dim.id
                    )
                  }
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        dim.id.includes("strategy")
                          ? "bg-blue-500"
                          : "bg-gray-500"
                      }`}
                    />
                    <h3 className="text-sm font-semibold text-gray-800">
                      {isAr ? dim.nameAr : dim.nameEn}
                    </h3>
                    <span className="text-xs text-gray-400">
                      ({dim.controls.length} {dict.gapAnalysis.controls})
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">
                    {dim.controls.map((control) => {
                      const currentStatus =
                        assessments[control.id]?.status || null;
                      return (
                        <div
                          key={control.id}
                          className="border border-gray-100 rounded-xl p-4"
                        >
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-gray-800">
                                {isAr ? control.nameAr : control.nameEn}
                              </h4>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {control.specs.length}{" "}
                                {dict.gapAnalysis.specs}
                              </p>
                            </div>
                          </div>

                          {/* Status buttons */}
                          <div className="flex gap-2">
                            {(
                              [
                                "compliant",
                                "partial",
                                "non-compliant",
                              ] as const
                            ).map((status) => {
                              const cfg = STATUS_CONFIG[status];
                              const Icon = cfg.icon;
                              const isSelected = currentStatus === status;
                              return (
                                <button
                                  key={status}
                                  onClick={() =>
                                    handleStatusChange(
                                      control.id,
                                      isSelected ? null : status
                                    )
                                  }
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                    isSelected
                                      ? cfg.colorClass
                                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                  }`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                  {statusLabels[status]}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary bar + Generate report */}
      {assessedControls.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-sm font-semibold text-gray-700">
                {dict.gapAnalysis.overallCompliance}:{" "}
              </span>
              <span
                className={`text-lg font-bold ${
                  overallScore >= 75
                    ? "text-emerald-600"
                    : overallScore >= 40
                      ? "text-amber-600"
                      : "text-red-600"
                }`}
              >
                {overallScore}%
              </span>
            </div>
            <span className="text-xs text-gray-400">
              {assessedControls.length}/{allControls.length}{" "}
              {dict.gapAnalysis.controls}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex mb-4">
            {compliantCount > 0 && (
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{
                  width: `${(compliantCount / allControls.length) * 100}%`,
                }}
              />
            )}
            {partialCount > 0 && (
              <div
                className="bg-amber-500 h-full transition-all"
                style={{
                  width: `${(partialCount / allControls.length) * 100}%`,
                }}
              />
            )}
            {nonCompliantCount > 0 && (
              <div
                className="bg-red-500 h-full transition-all"
                style={{
                  width: `${(nonCompliantCount / allControls.length) * 100}%`,
                }}
              />
            )}
          </div>

          <button
            onClick={() => setShowReport(true)}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            {dict.gapAnalysis.generateReport}
          </button>
        </div>
      )}
    </div>
  );
}
