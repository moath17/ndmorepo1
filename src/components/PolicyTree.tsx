"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Layers,
  Shield,
  FileCheck,
  Search,
} from "lucide-react";
import type {
  Dictionary,
  Locale,
  PolicyDomain,
  PolicyDimension,
  PolicyControl,
} from "@/types";

interface PolicyTreeProps {
  domains: PolicyDomain[];
  dict: Dictionary;
  locale: Locale;
}

const DOMAIN_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  "data-governance": { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", dot: "bg-blue-500" },
  "data-classification": { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  "data-sharing": { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", dot: "bg-purple-500" },
  "open-data": { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500" },
};

function getColor(id: string) {
  return DOMAIN_COLORS[id] || { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700", dot: "bg-gray-500" };
}

function ControlCard({
  control,
  locale,
  index,
}: {
  control: PolicyControl;
  locale: Locale;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const isAr = locale === "ar";

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden bg-white hover:border-gray-200 transition-colors">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-start hover:bg-gray-50/50 transition-colors"
      >
        <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-primary-600">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm text-gray-700 font-medium line-clamp-2">
            {isAr ? control.nameAr : control.nameEn}
          </span>
        </div>
        <span className="text-[10px] text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
          {control.specs.length}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>
      {open && control.specs.length > 0 && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-50">
          <div className="space-y-1.5">
            {control.specs.map((spec, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-xs text-gray-600 py-1"
              >
                <FileCheck className="w-3 h-3 text-primary-400 mt-0.5 flex-shrink-0" />
                <span className="leading-relaxed">{spec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DimensionSection({
  dimension,
  dict,
  locale,
  type,
}: {
  dimension: PolicyDimension;
  dict: Dictionary;
  locale: Locale;
  type: "strategy" | "implementation";
}) {
  const isAr = locale === "ar";
  const isStrategy = type === "strategy";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isStrategy
              ? "bg-blue-100 text-blue-600"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          <Shield className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-800">
            {isAr ? dimension.nameAr : dimension.nameEn}
          </h4>
          <span className="text-[11px] text-gray-400">
            {dimension.controls.length} {dict.dashboard.controls}
          </span>
        </div>
      </div>
      <div className="space-y-2 ms-1">
        {dimension.controls.map((control, idx) => (
          <ControlCard
            key={control.id}
            control={control}
            locale={locale}
            index={idx}
          />
        ))}
      </div>
    </div>
  );
}

export default function PolicyTree({
  domains,
  dict,
  locale,
}: PolicyTreeProps) {
  const [selectedDomain, setSelectedDomain] = useState<string>(
    domains[0]?.id || ""
  );
  const [search, setSearch] = useState("");
  const isAr = locale === "ar";

  const domain = domains.find((d) => d.id === selectedDomain);

  // Filter controls/specs by search
  const filteredDimensions = domain?.dimensions.map((dim) => {
    if (!search.trim()) return dim;
    const filtered = dim.controls.filter((c) => {
      const name = isAr ? c.nameAr : c.nameEn;
      const specs = c.specs.join(" ");
      const q = search.toLowerCase();
      return name.toLowerCase().includes(q) || specs.toLowerCase().includes(q);
    });
    return { ...dim, controls: filtered };
  }).filter((dim) => dim.controls.length > 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-800">
              {dict.dashboard.domains}
            </h2>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? "ابحث في الضوابط..." : "Search controls..."}
              className="ps-9 pe-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-44 sm:w-56"
            />
          </div>
        </div>

        {/* Domain tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-px">
          {domains.map((d) => {
            const isActive = selectedDomain === d.id;
            const color = getColor(d.id);
            return (
              <button
                key={d.id}
                onClick={() => {
                  setSelectedDomain(d.id);
                  setSearch("");
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                  isActive
                    ? `${color.bg} ${color.border} ${color.text}`
                    : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    isActive ? color.dot : "bg-gray-300"
                  }`}
                />
                {isAr ? d.nameAr : d.nameEn}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                    isActive
                      ? "bg-white/60 " + color.text
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {d.controlCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Domain content */}
      {domain && (
        <div className="p-5">
          {/* Domain summary bar */}
          <div className="flex items-center gap-4 mb-5 text-sm">
            <div className="flex items-center gap-1.5 text-gray-500">
              <Shield className="w-4 h-4" />
              <span className="font-medium">{domain.controlCount}</span>
              <span>{dict.dashboard.controls}</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-1.5 text-gray-500">
              <FileCheck className="w-4 h-4" />
              <span className="font-medium">{domain.specCount}</span>
              <span>{dict.dashboard.specs}</span>
            </div>
          </div>

          {/* Dimensions in a two-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredDimensions?.map((dim) => (
              <DimensionSection
                key={dim.id}
                dimension={dim}
                dict={dict}
                locale={locale}
                type={
                  dim.id.includes("strategy") ? "strategy" : "implementation"
                }
              />
            ))}
          </div>

          {filteredDimensions?.length === 0 && search && (
            <div className="text-center py-8 text-gray-400 text-sm">
              {isAr ? "لا توجد نتائج للبحث" : "No search results found"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
