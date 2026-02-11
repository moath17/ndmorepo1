"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Lock,
  FileText,
  Users,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  StickyNote,
  Calendar,
  LogIn,
  Globe,
  ClipboardCheck,
  Filter,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  Upload,
  RefreshCw,
  Loader2,
} from "lucide-react";
import type { Dictionary, Locale } from "@/types";

interface AdminPanelProps {
  dict: Dictionary;
  locale: Locale;
}

type Tab = "files" | "users" | "questions" | "feedback" | "notes" | "assessments";

interface AdminData {
  analytics: {
    total: number;
    upCount: number;
    downCount: number;
    unrated: number;
    satisfactionRate: number;
    reasonCounts: Record<string, number>;
    topQuestions: { question: string; count: number }[];
  };
  sessions: {
    id: string;
    name?: string;
    createdAt?: string;
    lastActive: string;
    questionsCount: number;
    locale?: string;
  }[];
  files: {
    filename: string;
    name?: string;
    uploadDate: string | null;
    fileDate: string | null;
    pageCount: number | null;
    language?: string | null;
    hash: string | null;
  }[];
  notes: {
    id: string;
    content: string;
    timestamp: string;
    sessionId: string;
  }[];
  questions: {
    question: string;
    answer: string;
    locale: string;
    timestamp: string;
    sessionId: string;
    userName?: string;
    rating: "up" | "down" | null;
  }[];
  assessments: {
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
  }[];
}

export default function AdminPanel({ dict, locale }: AdminPanelProps) {
  const isAr = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("feedback");
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<"all" | "up" | "down" | "none">("all");
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [filesSynced, setFilesSynced] = useState(false);
  const [managedFiles, setManagedFiles] = useState<Array<{
    filename: string;
    displayName: string;
    openaiFileId?: string;
    enabled: boolean;
    addedAt: string;
  }>>([]);
  const [togglingFile, setTogglingFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const toggleLang = () => {
    const newLocale = isAr ? "en" : "ar";
    const newPath = pathname.replace(/^\/(ar|en)/, `/${newLocale}`);
    router.push(newPath);
  };

  const handleLogin = async () => {
    setError("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", password }),
      });
      const result = await res.json();
      if (result.success) {
        setToken(result.token);
        localStorage.setItem("ndmo-admin-token", result.token);
      } else {
        setError(dict.admin.wrongPassword);
      }
    } catch {
      setError(dict.admin.connectionError);
    }
  };

  const fetchData = useCallback(async (authToken: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ action: "dashboard" }),
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        setToken(null);
        localStorage.removeItem("ndmo-admin-token");
      }
    } catch {
      // error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("ndmo-admin-token");
    if (saved) {
      setToken(saved);
      fetchData(saved);
    }
  }, [fetchData]);

  useEffect(() => {
    if (token) fetchData(token);
  }, [token, fetchData]);

  // Sync managed files when files tab is opened
  const syncFiles = useCallback(async () => {
    if (!token) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/files", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "sync" }),
      });
      const result = await res.json();
      if (result.files) setManagedFiles(result.files);
      setFilesSynced(true);
    } catch {
      // silent
    } finally {
      setSyncing(false);
    }
  }, [token]);

  useEffect(() => {
    if (tab === "files" && token && !filesSynced) {
      syncFiles();
    }
  }, [tab, token, filesSynced, syncFiles]);

  const handleToggleFile = async (filename: string, enabled: boolean) => {
    if (!token) return;
    setTogglingFile(filename);
    try {
      const res = await fetch("/api/admin/files", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "toggle", filename, enabled }),
      });
      const result = await res.json();
      if (result.success) {
        setManagedFiles((prev) =>
          prev.map((f) => (f.filename === filename ? { ...f, enabled } : f))
        );
      }
    } catch {
      // silent
    } finally {
      setTogglingFile(null);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    e.target.value = "";

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadMsg({ type: "err", text: isAr ? "فقط ملفات PDF مدعومة" : "Only PDF files supported" });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadMsg({ type: "err", text: isAr ? "الملف كبير جداً (أقصى 50MB)" : "File too large (max 50MB)" });
      return;
    }

    setUploading(true);
    setUploadMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/files", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const result = await res.json();

      if (result.success) {
        setUploadMsg({ type: "ok", text: isAr ? "تم رفع الملف بنجاح!" : "File uploaded successfully!" });
        if (result.file) {
          setManagedFiles((prev) => [...prev, result.file]);
        }
        // Refresh admin data
        fetchData(token);
      } else {
        setUploadMsg({ type: "err", text: result.error || "Upload failed" });
      }
    } catch {
      setUploadMsg({ type: "err", text: isAr ? "خطأ في الرفع" : "Upload error" });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadMsg(null), 5000);
    }
  };

  // Login screen
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 max-w-sm w-full relative"
          dir={isAr ? "rtl" : "ltr"}
        >
          {/* Language toggle */}
          <button
            onClick={toggleLang}
            className="absolute top-4 end-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <Globe className="w-3 h-3" />
            {isAr ? "EN" : "عربي"}
          </button>

          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">
              {dict.admin.title}
            </h1>
          </div>

          <div className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder={dict.admin.password}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
            <button
              onClick={handleLogin}
              className="w-full py-3 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              {dict.admin.login}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof FileText }[] = [
    { key: "feedback", label: dict.admin.quality, icon: BarChart3 },
    { key: "questions", label: dict.admin.questions, icon: MessageSquare },
    { key: "assessments", label: isAr ? "التقييمات" : "Assessments", icon: ClipboardCheck },
    { key: "files", label: dict.admin.files, icon: FileText },
    { key: "users", label: dict.admin.users, icon: Users },
    { key: "notes", label: dict.admin.notes, icon: StickyNote },
  ];

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString(isAr ? "ar-SA" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return date;
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-50"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-base font-semibold text-gray-800">
              {dict.admin.title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <Globe className="w-3 h-3" />
              {isAr ? "EN" : "عربي"}
            </button>
            <button
              onClick={() => {
                setToken(null);
                localStorage.removeItem("ndmo-admin-token");
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {dict.admin.logout}
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto pb-0">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    tab === t.key
                      ? "border-primary-600 text-primary-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading && !data && (
          <div className="text-center py-12 text-gray-400">
            {dict.admin.loading}
          </div>
        )}

        {data && tab === "feedback" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label={dict.admin.totalQuestions}
                value={data.analytics.total}
                color="text-blue-600 bg-blue-50"
              />
              <StatCard
                label={dict.admin.positive}
                value={data.analytics.upCount}
                color="text-emerald-600 bg-emerald-50"
                icon={<ThumbsUp className="w-4 h-4" />}
              />
              <StatCard
                label={dict.admin.negative}
                value={data.analytics.downCount}
                color="text-red-600 bg-red-50"
                icon={<ThumbsDown className="w-4 h-4" />}
              />
              <StatCard
                label={dict.admin.satisfaction}
                value={`${data.analytics.satisfactionRate}%`}
                color="text-amber-600 bg-amber-50"
              />
            </div>

            {Object.keys(data.analytics.reasonCounts).length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {dict.admin.topReasons}
                </h3>
                <div className="space-y-2">
                  {Object.entries(data.analytics.reasonCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([reason, count]) => (
                      <div key={reason} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{reason}</span>
                        <span className="text-gray-400 font-medium">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {data.analytics.topQuestions.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {dict.admin.topQuestions}
                </h3>
                <div className="space-y-2">
                  {data.analytics.topQuestions.map((q, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 truncate flex-1">{q.question}</span>
                      <span className="text-gray-400 font-medium ms-2">{q.count}x</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {data && tab === "questions" && (
          <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-gray-400" />
              {(["all", "down", "up", "none"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setRatingFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    ratingFilter === f
                      ? "bg-primary-600 text-white border-primary-600"
                      : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {f === "all" ? (isAr ? "الكل" : "All") :
                   f === "down" ? (isAr ? "سلبي ⬇" : "Negative ⬇") :
                   f === "up" ? (isAr ? "إيجابي ⬆" : "Positive ⬆") :
                   (isAr ? "بدون تقييم" : "Unrated")}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-start py-3 px-4 font-medium text-gray-500">{dict.admin.question}</th>
                      <th className="text-start py-3 px-4 font-medium text-gray-500">{dict.admin.name}</th>
                      <th className="text-start py-3 px-4 font-medium text-gray-500">{dict.admin.rating}</th>
                      <th className="text-start py-3 px-4 font-medium text-gray-500">{dict.admin.time}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.questions
                      .filter((q) => {
                        if (ratingFilter === "all") return true;
                        if (ratingFilter === "down") return q.rating === "down";
                        if (ratingFilter === "up") return q.rating === "up";
                        return !q.rating;
                      })
                      .map((q, i) => (
                      <>
                        <tr
                          key={i}
                          className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                          onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                        >
                          <td className="py-3 px-4 text-gray-700">
                            <div className="flex items-center gap-2">
                              {expandedQ === i ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                              <span className="truncate max-w-xs">{q.question}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-xs">{q.userName || "-"}</td>
                          <td className="py-3 px-4">
                            {q.rating === "up" && <ThumbsUp className="w-4 h-4 text-emerald-500" />}
                            {q.rating === "down" && <ThumbsDown className="w-4 h-4 text-red-500" />}
                            {!q.rating && <span className="text-gray-300">-</span>}
                          </td>
                          <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">{formatDate(q.timestamp)}</td>
                        </tr>
                        {expandedQ === i && (
                          <tr key={`${i}-expanded`} className="bg-gray-50">
                            <td colSpan={4} className="py-3 px-6">
                              <p className="text-xs font-medium text-gray-500 mb-1">{dict.admin.answer}:</p>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{q.answer}</p>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                    {data.questions.length === 0 && (
                      <tr><td colSpan={4} className="py-12 text-center text-gray-400">{dict.admin.noData}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {data && tab === "files" && (
          <div className="space-y-4">
            {/* Action bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors cursor-pointer">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? (isAr ? "جارٍ الرفع..." : "Uploading...") : (isAr ? "رفع ملف PDF" : "Upload PDF")}
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleUploadFile}
                  disabled={uploading}
                />
              </label>
              <button
                onClick={syncFiles}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                {isAr ? "مزامنة" : "Sync"}
              </button>
              {uploadMsg && (
                <span className={`text-sm font-medium ${uploadMsg.type === "ok" ? "text-emerald-600" : "text-red-500"}`}>
                  {uploadMsg.text}
                </span>
              )}
            </div>

            {/* Files table with toggle */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-start py-3 px-4 font-medium text-gray-500 w-10">
                        {isAr ? "الحالة" : "Status"}
                      </th>
                      <th className="text-start py-3 px-4 font-medium text-gray-500">{dict.admin.fileName}</th>
                      <th className="text-start py-3 px-4 font-medium text-gray-500">{dict.admin.pages}</th>
                      <th className="text-start py-3 px-4 font-medium text-gray-500">{dict.admin.uploadDate}</th>
                      <th className="text-start py-3 px-4 font-medium text-gray-500">{dict.admin.fileDate}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.files.map((f, i) => {
                      const managed = managedFiles.find(
                        (mf) => mf.filename === f.filename || mf.filename === (f.name || f.filename)
                      );
                      const isEnabled = managed ? managed.enabled : true;
                      const isToggling = togglingFile === (managed?.filename || f.filename);

                      return (
                        <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 ${!isEnabled ? "opacity-50" : ""}`}>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => {
                                const fn = managed?.filename || f.filename;
                                handleToggleFile(fn, !isEnabled);
                              }}
                              disabled={isToggling}
                              className="transition-colors"
                              title={isEnabled ? (isAr ? "مفعّل — اضغط للإيقاف" : "Active — click to disable") : (isAr ? "معطّل — اضغط للتفعيل" : "Disabled — click to enable")}
                            >
                              {isToggling ? (
                                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                              ) : isEnabled ? (
                                <ToggleRight className="w-6 h-6 text-emerald-500" />
                              ) : (
                                <ToggleLeft className="w-6 h-6 text-gray-300" />
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-primary-500 flex-shrink-0" />
                              <div>
                                <div className="font-medium">{f.name || f.filename}</div>
                                {f.name && <div className="text-[11px] text-gray-400 mt-0.5">{f.filename}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{f.pageCount || "-"}</td>
                          <td className="py-3 px-4 text-gray-500 text-xs">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {f.uploadDate ? formatDate(f.uploadDate) : "-"}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-xs">
                            {f.fileDate ? formatDate(f.fileDate) : "-"}
                          </td>
                        </tr>
                      );
                    })}
                    {data.files.length === 0 && (
                      <tr><td colSpan={5} className="py-12 text-center text-gray-400">{dict.admin.noData}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {data && tab === "users" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-start py-3 px-4 font-medium text-gray-500">{dict.admin.name}</th>
                    <th className="text-start py-3 px-4 font-medium text-gray-500">{dict.admin.questionsCount}</th>
                    <th className="text-start py-3 px-4 font-medium text-gray-500">{dict.admin.locale}</th>
                    <th className="text-start py-3 px-4 font-medium text-gray-500">{dict.admin.firstVisit}</th>
                    <th className="text-start py-3 px-4 font-medium text-gray-500">{dict.admin.lastActive}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sessions.map((s, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-700">
                        {s.name || <span className="text-gray-300">{dict.admin.guest}</span>}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{s.questionsCount}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {s.locale === "ar" ? "العربية" : s.locale === "en" ? "English" : "-"}
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs">
                        {s.createdAt ? formatDate(s.createdAt) : "-"}
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs">
                        {formatDate(s.lastActive)}
                      </td>
                    </tr>
                  ))}
                  {data.sessions.length === 0 && (
                    <tr><td colSpan={5} className="py-12 text-center text-gray-400">{dict.admin.noData}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data && tab === "assessments" && (
          <div className="space-y-4">
            {data.assessments.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                {dict.admin.noData}
              </div>
            )}
            {data.assessments.map((a) => (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                      a.overallScore >= 75 ? "bg-emerald-100 text-emerald-700" :
                      a.overallScore >= 40 ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {a.overallScore}%
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{a.userName}</p>
                      <p className="text-xs text-gray-400">{formatDate(a.timestamp)}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded">{isAr ? "نعم" : "Yes"}: {a.answeredYes}</span>
                    <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded">{isAr ? "جزئي" : "Partial"}: {a.answeredPartial}</span>
                    <span className="px-2 py-1 bg-red-50 text-red-700 rounded">{isAr ? "لا" : "No"}: {a.answeredNo}</span>
                  </div>
                </div>
                {a.categoryScores.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-100">
                    {a.categoryScores.map((cs) => (
                      <div key={cs.id} className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              cs.score >= 75 ? "bg-emerald-500" :
                              cs.score >= 40 ? "bg-amber-500" : "bg-red-500"
                            }`}
                            style={{ width: `${cs.score}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 w-8 text-end">{cs.score}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {data && tab === "notes" && (
          <div className="space-y-3">
            {data.notes.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                {dict.admin.noData}
              </div>
            )}
            {data.notes.map((note) => (
              <div key={note.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-sm text-gray-700 leading-relaxed">{note.content}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                  <span>{formatDate(note.timestamp)}</span>
                  <span className="font-mono">{note.sessionId}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number | string;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon || <BarChart3 className="w-5 h-5" />}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
