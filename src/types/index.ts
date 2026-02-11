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
  page?: number;
  snippet?: string;
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
    errorDailyLimit: string;
    errorBlocked: string;
    welcomeMessage: string;
    suggestionsTitle: string;
    suggestions: string[];
    searching: string;
    generating: string;
    copy: string;
    copied: string;
    helpful: string;
    notHelpful: string;
    replyTo: string;
    replyPrefix: string;
    reply: string;
    followUp: string;
    detailsByCategory: string;
    complianceRadar: string;
    score: string;
    specRef: string;
  };
  language: {
    toggle: string;
    ar: string;
    en: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    totalDomains: string;
    totalControls: string;
    totalSpecs: string;
    totalDocuments: string;
    totalPages: string;
    domains: string;
    controls: string;
    specs: string;
    dimensions: string;
    strategy: string;
    implementation: string;
    documents: string;
    controlDistribution: string;
    specDistribution: string;
    backToChat: string;
    searchDocuments: string;
    document: string;
    pages: string;
    languageLabel: string;
    noResults: string;
  };
  nav: {
    chat: string;
    dashboard: string;
    assessment: string;
    gapAnalysis: string;
  };
  assessment: {
    title: string;
    subtitle: string;
    yes: string;
    partial: string;
    no: string;
    next: string;
    previous: string;
    submit: string;
    restart: string;
    results: string;
    overallScore: string;
    categoryScore: string;
    compliant: string;
    partiallyCompliant: string;
    nonCompliant: string;
    recommendation: string;
    highCompliance: string;
    mediumCompliance: string;
    lowCompliance: string;
    questionOf: string;
    exportResults: string;
  };
  gapAnalysis: {
    title: string;
    subtitle: string;
    selectDomain: string;
    requirements: string;
    compliant: string;
    partial: string;
    nonCompliant: string;
    notAssessed: string;
    generateReport: string;
    generating: string;
    gapReport: string;
    recommendation: string;
    controls: string;
    specs: string;
    overallCompliance: string;
  };
  admin: {
    title: string;
    password: string;
    login: string;
    logout: string;
    wrongPassword: string;
    connectionError: string;
    loading: string;
    files: string;
    users: string;
    questions: string;
    feedback: string;
    quality: string;
    notes: string;
    uploadDate: string;
    fileDate: string;
    fileName: string;
    pages: string;
    totalQuestions: string;
    positive: string;
    negative: string;
    unrated: string;
    satisfaction: string;
    topReasons: string;
    topQuestions: string;
    noData: string;
    sessionId: string;
    name: string;
    guest: string;
    lastActive: string;
    firstVisit: string;
    locale: string;
    questionsCount: string;
    question: string;
    answer: string;
    rating: string;
    time: string;
  };
  feedback: {
    whatWrong: string;
    incorrect: string;
    incomplete: string;
    wrongSource: string;
    didntUnderstand: string;
    submit: string;
    cancel: string;
    thankYou: string;
  };
  notes: {
    title: string;
    placeholder: string;
    submit: string;
    success: string;
    buttonLabel: string;
  };
}

export interface PolicyDomain {
  id: string;
  nameAr: string;
  nameEn: string;
  controlCount: number;
  specCount: number;
  dimensions: PolicyDimension[];
}

export interface PolicyDimension {
  id: string;
  nameAr: string;
  nameEn: string;
  controls: PolicyControl[];
}

export interface PolicyControl {
  id: string;
  nameAr: string;
  nameEn: string;
  specs: string[];
}

export interface PoliciesStructure {
  domains: PolicyDomain[];
  summary: {
    totalDomains: number;
    totalControls: number;
    totalSpecs: number;
    documents: Array<{
      name: string;
      file: string;
      pages: number;
      language: string;
    }>;
  };
}
