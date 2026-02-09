"use client";

import { FileText } from "lucide-react";
import type { Dictionary, UploadedFile } from "@/types";

interface UploadedFilesListProps {
  dict: Dictionary;
  files: UploadedFile[];
}

export default function UploadedFilesList({
  dict,
  files,
}: UploadedFilesListProps) {
  if (files.length === 0) {
    return (
      <div className="mt-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {dict.upload.uploadedFiles}
        </h3>
        <p className="text-sm text-gray-400 italic">{dict.upload.noFiles}</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {dict.upload.uploadedFiles}
      </h3>
      <ul className="space-y-2">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg"
          >
            <FileText className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-700 truncate">
                {file.originalName}
              </p>
              <p className="text-xs text-gray-400">
                {file.pageCount} {dict.upload.pages}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
