"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { Dictionary, UploadedFile, UploadResponse } from "@/types";

interface FileUploadProps {
  dict: Dictionary;
  onFilesUploaded: (files: UploadedFile[]) => void;
}

type UploadStatus = "idle" | "uploading" | "processing" | "success" | "error";

export default function FileUpload({ dict, onFilesUploaded }: FileUploadProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);

      // Client-side validation
      for (const file of files) {
        if (file.type !== "application/pdf") {
          setErrorMessage(dict.upload.errorType);
          setStatus("error");
          return;
        }
        if (file.size > 100 * 1024 * 1024) {
          setErrorMessage(dict.upload.errorSize);
          setStatus("error");
          return;
        }
      }

      setStatus("uploading");
      setErrorMessage("");

      try {
        const formData = new FormData();
        for (const file of files) {
          formData.append("files", file);
        }

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data: UploadResponse = await response.json();

        if (response.status === 429) {
          setErrorMessage(dict.chat.errorRateLimit);
          setStatus("error");
          return;
        }

        if (data.success && data.files.length > 0) {
          setStatus("success");
          onFilesUploaded(data.files);
          // Reset after 3 seconds
          setTimeout(() => setStatus("idle"), 3000);
        } else {
          setErrorMessage(data.error || dict.upload.errorGeneric);
          setStatus("error");
        }
      } catch {
        setErrorMessage(dict.upload.errorGeneric);
        setStatus("error");
      }
    },
    [dict, onFilesUploaded]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files);
      }
    },
    [uploadFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        uploadFiles(e.target.files);
      }
    },
    [uploadFiles]
  );

  const isUploading = status === "uploading" || status === "processing";

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
        {dict.upload.title}
      </h2>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-2 p-6
          border-2 border-dashed rounded-xl cursor-pointer transition-all
          ${
            isDragOver
              ? "border-primary-500 bg-primary-50"
              : "border-gray-300 hover:border-primary-400 hover:bg-gray-50"
          }
          ${isUploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        {isUploading ? (
          <>
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            <p className="text-sm text-gray-600">
              {status === "uploading" ? dict.upload.uploading : dict.upload.processing}
            </p>
          </>
        ) : status === "success" ? (
          <>
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <p className="text-sm text-green-600">{dict.upload.success}</p>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 text-gray-400" />
            <div className="text-center">
              <p className="text-sm text-gray-600">
                {dict.upload.dragDrop}{" "}
                <span className="text-primary-600 font-medium">
                  {dict.upload.browse}
                </span>
              </p>
              <p className="text-xs text-gray-400 mt-1">{dict.upload.maxSize}</p>
            </div>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          aria-label={dict.upload.browse}
        />
      </div>

      {/* Error Message */}
      {status === "error" && errorMessage && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
