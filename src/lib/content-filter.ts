/**
 * Content filtering module for security and legal protection.
 * Blocks inappropriate content, prompt injection attempts, and off-topic queries.
 */

interface FilterResult {
  blocked: boolean;
  reason?: string;
  category?: "inappropriate" | "injection" | "offtopic";
}

// --- Inappropriate / Abusive content patterns (Arabic + English) ---
const INAPPROPRIATE_PATTERNS: RegExp[] = [
  // English profanity and slurs (broad patterns)
  /\b(fuck|shit|damn|bitch|ass(?:hole)?|bastard|dick|cock|pussy|whore|slut|cunt|nigger|faggot|retard)\b/i,
  /\b(porn|xxx|nude|naked|sex(?:ual)?|hentai|erotic)\b/i,
  /\b(kill\s+(?:you|him|her|them|myself)|murder|suicide|bomb|terrorist|terrorism)\b/i,
  /\b(drug\s+deal|cocaine|heroin|meth(?:amphetamine)?)\b/i,
  // Arabic inappropriate words
  /\b(كس\s*أم|كسم|طيز|زب|شرموط|عرص|متناك|منيوك|قحب|لعن|يلعن)\b/,
  /\b(نيك|انيك|ينيك|تنيك|منيوك)\b/,
  /\b(حمار|كلب|حيوان|خنزير)\b.*\b(انت|أنت|يا)\b/,
  /\b(يا)\b.*\b(حمار|كلب|حيوان|خنزير|غبي|أحمق|أهبل)\b/,
];

// --- Prompt injection patterns ---
const INJECTION_PATTERNS: RegExp[] = [
  // English injection attempts
  /ignore\s+(all\s+)?previous\s+(instructions|rules|prompts)/i,
  /ignore\s+(the\s+)?(above|system)\s+(prompt|instructions|rules)/i,
  /you\s+are\s+now\s+(a|an|my)/i,
  /pretend\s+(you\s+are|to\s+be|you're)/i,
  /act\s+as\s+(a|an|if|though)/i,
  /new\s+(instructions|rules|prompt|role)/i,
  /forget\s+(everything|all|your|previous)/i,
  /override\s+(your|the|all)\s+(rules|instructions|prompt)/i,
  /reveal\s+(your|the)\s+(system\s+)?(prompt|instructions|rules)/i,
  /what\s+(is|are)\s+your\s+(system\s+)?(prompt|instructions|rules)/i,
  /repeat\s+(your|the)\s+(system\s+)?(prompt|instructions)/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /developer\s+mode/i,
  // Arabic injection attempts
  /تجاهل\s+(كل\s+)?التعليمات/,
  /تجاهل\s+(القواعد|الأوامر|النظام)/,
  /تصرف\s+(كأنك|وكأنك|على\s+أنك)/,
  /تظاهر\s+(بأنك|أنك|إنك)/,
  /أنسى?\s+(كل|جميع|التعليمات)/,
  /اكشف\s+(لي\s+)?(التعليمات|الأوامر|النظام)/,
  /ما\s+هي\s+تعليماتك/,
  /أعد\s+(لي\s+)?تعليماتك/,
];

// --- Off-topic patterns (clearly unrelated to data governance) ---
const OFFTOPIC_PATTERNS: RegExp[] = [
  /\b(recipe|cook|cooking|food|restaurant)\b/i,
  /\b(movie|film|song|music|game|sport|football|soccer)\b/i,
  /\b(weather|temperature|forecast)\b/i,
  /\b(joke|funny|humor|laugh)\b/i,
  /\b(love|dating|relationship|marriage)\b/i,
  /\b(وصفة|طبخ|أكل|مطعم)\b/,
  /\b(فيلم|أغنية|موسيقى|لعبة|كرة|رياضة)\b/,
  /\b(طقس|حرارة|جو)\b/,
  /\b(نكتة|مضحك|ضحك)\b/,
];

/**
 * Check if user input contains blocked content.
 * Returns { blocked: true, reason, category } if content should be rejected.
 */
export function filterInput(text: string): FilterResult {
  const normalized = text.trim();

  // Check for empty input
  if (normalized.length === 0) {
    return { blocked: true, reason: "Empty message", category: "offtopic" };
  }

  // Check for very long input (potential abuse)
  if (normalized.length > 2000) {
    return {
      blocked: true,
      reason: "Message too long",
      category: "inappropriate",
    };
  }

  // Check inappropriate content
  for (const pattern of INAPPROPRIATE_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        blocked: true,
        reason: "Inappropriate content detected",
        category: "inappropriate",
      };
    }
  }

  // Check prompt injection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        blocked: true,
        reason: "Invalid request",
        category: "injection",
      };
    }
  }

  return { blocked: false };
}

/**
 * Filter output from the AI before sending to the user.
 * Ensures no system prompt leakage or inappropriate generated content.
 */
export function filterOutput(text: string): string {
  let filtered = text;

  // Remove any accidental system prompt leakage
  const leakagePatterns = [
    /STRICT RULES[\s\S]{0,500}/gi,
    /system\s*prompt[\s\S]{0,200}/gi,
    /\[?SYSTEM\]?:[\s\S]{0,200}/gi,
  ];

  for (const pattern of leakagePatterns) {
    filtered = filtered.replace(pattern, "");
  }

  return filtered.trim();
}

/**
 * Check if a question seems off-topic (not related to documents/policies).
 * This is a soft check — the system prompt also handles this, but this adds a layer.
 */
export function isOffTopic(text: string): boolean {
  const normalized = text.trim().toLowerCase();

  // Very short messages that are greetings are OK
  if (normalized.length < 20) {
    return false;
  }

  let offTopicMatches = 0;
  for (const pattern of OFFTOPIC_PATTERNS) {
    if (pattern.test(normalized)) {
      offTopicMatches++;
    }
  }

  // Only block if multiple off-topic signals (to avoid false positives)
  return offTopicMatches >= 2;
}
