"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import type { Dictionary, Locale } from "@/types";
import AssessmentResults from "./AssessmentResults";
import assessmentData from "@/data/assessment-questions.json";

interface AssessmentFormProps {
  dict: Dictionary;
  locale: Locale;
}

type Answer = "yes" | "partial" | "no" | null;

interface QuestionAnswer {
  questionId: string;
  categoryId: string;
  answer: Answer;
}

interface Question {
  id: string;
  questionAr: string;
  questionEn: string;
  specRef?: string;
  categoryId: string;
  isParent?: boolean;
  parentId?: string;
  showWhen?: string;
}

export default function AssessmentForm({ dict, locale }: AssessmentFormProps) {
  const isAr = locale === "ar";

  // All questions with category info
  const allQuestions: Question[] = useMemo(
    () =>
      assessmentData.categories.flatMap((cat) =>
        cat.questions.map((q) => ({
          ...q,
          categoryId: cat.id,
          specRef: (q as Record<string, unknown>).specRef as string | undefined,
          isParent: (q as Record<string, unknown>).isParent as boolean | undefined,
          parentId: (q as Record<string, unknown>).parentId as string | undefined,
          showWhen: (q as Record<string, unknown>).showWhen as string | undefined,
        }))
      ),
    []
  );

  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [showResults, setShowResults] = useState(false);

  // Filter visible questions based on adaptive logic
  const visibleQuestions = useMemo(() => {
    return allQuestions.filter((q) => {
      // If no parentId, always show
      if (!q.parentId) return true;
      // Show child question only if parent was answered with the showWhen value
      const parentAnswer = answers[q.parentId];
      return parentAnswer === q.showWhen;
    });
  }, [allQuestions, answers]);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Clamp currentIndex if visible questions changed
  const safeIndex = Math.min(currentIndex, visibleQuestions.length - 1);
  const currentQuestion = visibleQuestions[safeIndex];
  const currentCategory = assessmentData.categories.find(
    (c) => c.id === currentQuestion?.categoryId
  );
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] || null : null;

  const handleAnswer = (answer: Answer) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: answer }));
  };

  const canGoNext = safeIndex < visibleQuestions.length - 1;
  const canGoPrev = safeIndex > 0;
  const answeredCount = visibleQuestions.filter(
    (q) => answers[q.id] != null
  ).length;

  if (showResults) {
    // Convert to the format expected by AssessmentResults
    const resultAnswers: QuestionAnswer[] = visibleQuestions.map((q) => ({
      questionId: q.id,
      categoryId: q.categoryId,
      answer: answers[q.id] || null,
    }));

    return (
      <AssessmentResults
        answers={resultAnswers}
        categories={assessmentData.categories}
        dict={dict}
        locale={locale}
        onRestart={() => {
          setAnswers({});
          setCurrentIndex(0);
          setShowResults(false);
        }}
      />
    );
  }

  const answerOptions: { value: Answer; label: string; color: string }[] = [
    {
      value: "yes",
      label: dict.assessment.yes,
      color:
        "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    },
    {
      value: "partial",
      label: dict.assessment.partial,
      color:
        "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
    },
    {
      value: "no",
      label: dict.assessment.no,
      color: "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
    },
  ];

  const progressPercent = Math.round(
    (answeredCount / visibleQuestions.length) * 100
  );

  return (
    <div className="max-w-2xl mx-auto px-1">
      {/* Progress */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-between text-xs sm:text-sm text-gray-500 mb-2">
          <span>
            {dict.assessment.questionOf
              .replace("{current}", String(safeIndex + 1))
              .replace("{total}", String(visibleQuestions.length))}
          </span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Category badge */}
      <div className="mb-3 sm:mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium px-3 py-1 rounded-full bg-primary-100 text-primary-700">
          {isAr ? currentCategory?.nameAr : currentCategory?.nameEn}
        </span>
        {currentQuestion?.parentId && (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700">
            {dict.chat.followUp}
          </span>
        )}
      </div>

      {/* Question */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm mb-2 sm:mb-3">
        <h3 className="text-base sm:text-lg font-medium text-gray-800 leading-relaxed">
          {isAr
            ? currentQuestion?.questionAr
            : currentQuestion?.questionEn}
        </h3>
      </div>

      {/* Source reference under question */}
      {currentQuestion?.specRef && (
        <div className="flex items-center gap-2 mb-4 sm:mb-6 px-1">
          <span className="text-[11px] text-gray-400">📄 {dict.chat.specRef}:</span>
          <span className="text-[11px] font-mono text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
            {currentQuestion.specRef}
          </span>
          <span className="text-[11px] text-gray-400">—</span>
          <span className="text-[11px] text-gray-400 truncate">
            {isAr ? "ضوابط ومواصفات إدارة البيانات الوطنية" : "National Data Management Standards"}
          </span>
        </div>
      )}

      {/* Answer options */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6 sm:mb-8">
        {answerOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => handleAnswer(option.value)}
            className={`flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-3 sm:py-4 rounded-xl border-2 text-sm sm:text-base font-medium transition-all
              ${
                currentAnswer === option.value
                  ? `${option.color} ring-2 ring-offset-1 ring-primary-300`
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
          >
            {currentAnswer === option.value && (
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            )}
            {option.label}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={!canGoPrev}
          className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {isAr ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{dict.assessment.previous}</span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {answeredCount > 0 && (
            <button
              onClick={() => {
                // Treat unanswered visible questions as "no"
                const updated = { ...answers };
                for (const q of visibleQuestions) {
                  if (updated[q.id] == null) {
                    updated[q.id] = "no";
                  }
                }
                setAnswers(updated);
                setShowResults(true);
              }}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >
              {dict.assessment.submit}
              <span className="text-[10px] sm:text-xs opacity-80">
                ({answeredCount}/{visibleQuestions.length})
              </span>
            </button>
          )}

          {canGoNext && (
            <button
              onClick={() =>
                setCurrentIndex((i) =>
                  Math.min(visibleQuestions.length - 1, i + 1)
                )
              }
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors"
            >
              <span className="hidden sm:inline">{dict.assessment.next}</span>
              {isAr ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
