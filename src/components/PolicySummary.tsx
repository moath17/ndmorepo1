"use client";

import { Database, Shield, FileText, Files, BookOpen } from "lucide-react";
import type { Dictionary, PoliciesStructure } from "@/types";

interface PolicySummaryProps {
  structure: PoliciesStructure;
  dict: Dictionary;
}

export default function PolicySummary({ structure, dict }: PolicySummaryProps) {
  const { summary } = structure;
  const totalPages = summary.documents.reduce((sum, d) => sum + d.pages, 0);

  const stats = [
    {
      label: dict.dashboard.totalDomains,
      value: summary.totalDomains,
      icon: Database,
      color: "from-blue-500 to-blue-600",
      bg: "bg-blue-50",
      text: "text-blue-700",
      ring: "ring-blue-200",
    },
    {
      label: dict.dashboard.totalControls,
      value: summary.totalControls,
      icon: Shield,
      color: "from-emerald-500 to-emerald-600",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      ring: "ring-emerald-200",
    },
    {
      label: dict.dashboard.totalSpecs,
      value: summary.totalSpecs,
      icon: FileText,
      color: "from-purple-500 to-purple-600",
      bg: "bg-purple-50",
      text: "text-purple-700",
      ring: "ring-purple-200",
    },
    {
      label: dict.dashboard.totalDocuments,
      value: summary.documents.length,
      icon: Files,
      color: "from-amber-500 to-amber-600",
      bg: "bg-amber-50",
      text: "text-amber-700",
      ring: "ring-amber-200",
    },
    {
      label: dict.dashboard.totalPages,
      value: totalPages,
      icon: BookOpen,
      color: "from-rose-500 to-rose-600",
      bg: "bg-rose-50",
      text: "text-rose-700",
      ring: "ring-rose-200",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={`relative overflow-hidden bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow ring-1 ${stat.ring}`}
          >
            {/* Decorative background */}
            <div
              className={`absolute -top-4 -end-4 w-20 h-20 rounded-full ${stat.bg} opacity-60`}
            />
            <div className="relative">
              <div
                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3 shadow-sm`}
              >
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-3xl font-bold text-gray-800">{stat.value}</p>
              <p className={`text-xs font-medium mt-1 ${stat.text}`}>
                {stat.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
