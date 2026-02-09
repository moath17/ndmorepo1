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
    welcomeMessage: string;
  };
  language: {
    toggle: string;
    ar: string;
    en: string;
  };
}
