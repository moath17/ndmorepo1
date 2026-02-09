export type Locale = "ar" | "en";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  timestamp: number;
}

export interface Source {
  document: string;
  page: number;
}

export interface UploadedFile {
  id: string;
  originalName: string;
  sanitizedName: string;
  openaiFileId: string;
  pageCount: number;
  uploadedAt: string;
}

export interface UploadResponse {
  success: boolean;
  files: UploadedFile[];
  error?: string;
}

export interface ChatRequest {
  message: string;
  locale: Locale;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
  error?: string;
}

export interface Dictionary {
  meta: {
    title: string;
    description: string;
    keywords: string;
  };
  chat: {
    heading: string;
    subheading: string;
    placeholder: string;
    send: string;
    thinking: string;
    notFound: string;
    sources: string;
    errorGeneric: string;
    errorRateLimit: string;
    errorNoFiles: string;
    welcomeMessage: string;
  };
  upload: {
    title: string;
    dragDrop: string;
    browse: string;
    uploading: string;
    processing: string;
    success: string;
    errorType: string;
    errorSize: string;
    errorGeneric: string;
    maxSize: string;
    uploadedFiles: string;
    noFiles: string;
    pages: string;
  };
  language: {
    toggle: string;
    ar: string;
    en: string;
  };
}
