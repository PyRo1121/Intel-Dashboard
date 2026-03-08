export const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_DIRECT_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_TEXT_LENGTH = 2500;
const TRANSLATE_TIMEOUT_MS = 15_000;
const IMAGE_TRANSLATE_TIMEOUT_MS = 20_000;
const GATEWAY_CACHE_TTL_SECONDS_TEXT = 24 * 60 * 60;
const GATEWAY_CACHE_TTL_SECONDS_VISION = 7 * 24 * 60 * 60;
const GATEWAY_MAX_ATTEMPTS = 1;
const BATCH_CONCURRENCY = 20;
const IMAGE_BATCH_CONCURRENCY = 10;
const MAX_TRANSLATE_ATTEMPTS = 3;
const FOREIGN_SCRIPT_RE =
  /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0E00-\u0E7F\u4E00-\u9FFF]/;
const FOREIGN_SCRIPT_RE_GLOBAL =
  /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0E00-\u0E7F\u4E00-\u9FFF]/g;
const ENGLISH_HINT_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "have",
  "will",
  "about",
  "after",
  "before",
  "over",
  "under",
  "into",
  "between",
  "during",
  "against",
  "today",
  "tomorrow",
  "yesterday",
  "report",
  "update",
  "attack",
  "defense",
  "military",
  "official",
  "breaking",
  "analysis",
  "forces",
  "operation",
  "intel",
]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function estimateTextTokenBudget(text: string, args: {
  min: number;
  max: number;
  multiplier: number;
  padding: number;
}): number {
  const normalized = text.trim();
  const approxInputTokens = Math.ceil(normalized.length / 4);
  return clamp(
    Math.ceil(approxInputTokens * args.multiplier) + args.padding,
    args.min,
    args.max,
  );
}

export function estimateTranslationMaxTokens(text: string): number {
  return estimateTextTokenBudget(text, {
    min: 48,
    max: 640,
    multiplier: 1.15,
    padding: 24,
  });
}

export function estimateImageTranslationMaxTokens(contextText = ""): number {
  return estimateTextTokenBudget(contextText, {
    min: 96,
    max: 480,
    multiplier: 1.25,
    padding: 96,
  });
}

function buildGatewayUrl(
  accountId: string,
  gatewayName: string,
): string {
  return `https://gateway.ai.cloudflare.com/v1/${accountId.trim()}/${gatewayName.trim()}/groq/chat/completions`;
}

export function isGatewayTranslationEnabled(config: TranslationConfig): boolean {
  return Boolean(
    config.gatewayToken?.trim() &&
    config.gatewayAccountId?.trim() &&
    config.gatewayName?.trim(),
  );
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildGatewayCacheKey(kind: "text" | "vision", primary: string, secondary = ""): Promise<string> {
  const normalizedPrimary = primary.replace(/\s+/g, " ").trim().slice(0, 2000);
  const normalizedSecondary = secondary.replace(/\s+/g, " ").trim().slice(0, 320);
  const payload = `${kind}|${GROQ_MODEL}|${normalizedPrimary}|${normalizedSecondary}`;
  return `telegram:${kind}:${payload.length}:${await sha256Hex(payload)}`;
}

function hasForeignScript(text: string): boolean {
  return FOREIGN_SCRIPT_RE.test(text);
}

function foreignScriptRatio(text: string): number {
  if (!text) return 0;
  const matches = text.match(FOREIGN_SCRIPT_RE_GLOBAL);
  if (!matches) return 0;
  return matches.length / text.length;
}

function likelyEnglishByWords(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  if (!words.length) return false;
  let hits = 0;
  for (const w of words) {
    if (ENGLISH_HINT_WORDS.has(w)) hits++;
  }
  return hits >= 2;
}

function shouldRetryOutput(source: string, translated: string): boolean {
  const trimmed = translated.trim();
  if (trimmed.length < 3) return true;
  if (trimmed.toLowerCase() === "onse" || trimmed.toLowerCase() === "onse }") {
    return true;
  }
  if (!hasForeignScript(source)) return false;
  // Keep retrying when result is still mostly foreign-script text.
  return foreignScriptRatio(trimmed) > 0.1;
}

export function detectLanguage(text: string): string {
  if (!text || text.length < 3) return "en";
  const sample = text.slice(0, 300);
  const len = sample.length || 1;

  if (hasForeignScript(sample)) {
    const cyrillicCount = (sample.match(/[\u0400-\u04FF]/g) || []).length;
    if (cyrillicCount / len > 0.18) return "ru";

    const arabicCount = (sample.match(/[\u0600-\u06FF]/g) || []).length;
    if (arabicCount / len > 0.12) return "ar";

    const hebrewCount = (sample.match(/[\u0590-\u05FF]/g) || []).length;
    if (hebrewCount / len > 0.12) return "he";

    const cjkCount = (sample.match(/[\u4E00-\u9FFF]/g) || []).length;
    if (cjkCount / len > 0.08) return "zh";
  }

  const cyrillicCount = (sample.match(/[\u0400-\u04FF]/g) || []).length;
  if (cyrillicCount / len > 0.25) return "ru";

  const arabicCount = (sample.match(/[\u0600-\u06FF]/g) || []).length;
  if (arabicCount / len > 0.15) return "ar";

  const hebrewCount = (sample.match(/[\u0590-\u05FF]/g) || []).length;
  if (hebrewCount / len > 0.15) return "he";

  const cjkCount = (sample.match(/[\u4E00-\u9FFF]/g) || []).length;
  if (cjkCount / len > 0.1) return "zh";

  // Latin-based non-English (Spanish, Portuguese, French, etc.)
  const accentedCount = (
    sample.match(/[áéíóúñüçàèìòùâêîôûäëïöü¿¡ãõ]/gi) || []
  ).length;
  if (accentedCount / len > 0.02) return "es";

  if (!likelyEnglishByWords(sample)) return "unknown";
  return "en";
}

export function needsTranslation(text: string, langHint: string): boolean {
  const candidate = text.trim();
  if (!candidate || candidate.length < 5 || candidate === "(media only)") return false;
  if (hasForeignScript(candidate)) return true;

  const normalizedHint = (langHint || "").trim().toLowerCase();
  if (normalizedHint && normalizedHint !== "en") {
    // For non-English channels, aggressively translate unless content is clearly English.
    return !likelyEnglishByWords(candidate);
  }

  const detected = detectLanguage(candidate);
  return detected !== "en";
}

type TranslationRoute = "gateway" | "direct";

type TranslateOneResult = {
  text: string;
  route: TranslationRoute;
};

export interface TranslationConfig {
  gatewayAccountId?: string;
  gatewayName?: string;
  gatewayToken?: string;
  cacheTtlTextSeconds?: number;
  cacheTtlVisionSeconds?: number;
  gatewayMaxAttempts?: number;
}

async function callGroq(
  route: TranslationRoute,
  text: string,
  apiKey: string,
  config: TranslationConfig,
): Promise<string> {
  const url =
    route === "gateway"
      ? buildGatewayUrl(config.gatewayAccountId!, config.gatewayName!)
      : GROQ_DIRECT_URL;

  const truncated =
    text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (route === "gateway") {
    if (!isGatewayTranslationEnabled(config)) {
      throw new Error("AI Gateway configuration is incomplete.");
    }
    const maxAttempts = Math.max(1, Math.floor(config.gatewayMaxAttempts ?? GATEWAY_MAX_ATTEMPTS));
    const cacheTtlSeconds = Math.max(0, Math.floor(config.cacheTtlTextSeconds ?? GATEWAY_CACHE_TTL_SECONDS_TEXT));
    headers["cf-aig-authorization"] = `Bearer ${config.gatewayToken}`;
    headers["cf-aig-cache-key"] = await buildGatewayCacheKey("text", truncated);
    headers["cf-aig-cache-ttl"] = String(cacheTtlSeconds);
    headers["cf-aig-request-timeout"] = String(Math.max(250, TRANSLATE_TIMEOUT_MS - 250));
    headers["cf-aig-max-attempts"] = String(maxAttempts);
    headers["cf-aig-collect-log"] = "false";
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: estimateTranslationMaxTokens(truncated),
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `Translate this text to natural English only. Keep names/links intact. Do not add commentary.\n\n${truncated}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(TRANSLATE_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq ${route} ${res.status}: ${body.slice(0, 200)}`);
  }

  const result = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return result.choices?.[0]?.message?.content?.trim() || text;
}

async function translateOne(
  text: string,
  apiKey: string,
  config: TranslationConfig,
): Promise<TranslateOneResult> {
  const source = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;

  if (isGatewayTranslationEnabled(config)) {
    for (let attempt = 0; attempt < MAX_TRANSLATE_ATTEMPTS; attempt++) {
      try {
        const translated = await callGroq("gateway", source, apiKey, config);
        if (shouldRetryOutput(source, translated)) continue;
        return { text: translated, route: "gateway" };
      } catch {
        // fall through to retry/fallback
      }
    }
  }

  for (let attempt = 0; attempt < MAX_TRANSLATE_ATTEMPTS; attempt++) {
    try {
      const translated = await callGroq("direct", source, apiKey, config);
      if (shouldRetryOutput(source, translated)) continue;
      return { text: translated, route: "direct" };
    } catch {
      // retry
    }
  }

  throw new Error("Translation failed across gateway and direct paths.");
}

export interface TranslationJob {
  index: number;
  text: string;
}

export interface ImageTranslationJob {
  index: number;
  imageUrl: string;
  contextText?: string;
}

export async function translateBatch(
  jobs: TranslationJob[],
  apiKey: string,
  config: TranslationConfig,
): Promise<{
  results: Map<number, string>;
  translated: number;
  failed: number;
  failedIndexes: number[];
  gatewaySuccess: number;
  directSuccess: number;
}> {
  const results = new Map<number, string>();
  let translated = 0;
  let failed = 0;
  const failedIndexes: number[] = [];
  let gatewaySuccess = 0;
  let directSuccess = 0;

  // Deduplicate identical payloads so repeated Telegram repost text is translated once.
  const groupedByText = new Map<string, { text: string; indexes: number[] }>();
  for (const job of jobs) {
    const key = job.text;
    const existing = groupedByText.get(key);
    if (existing) {
      existing.indexes.push(job.index);
      continue;
    }
    groupedByText.set(key, { text: job.text, indexes: [job.index] });
  }
  const uniqueJobs = Array.from(groupedByText.values());

  for (let i = 0; i < uniqueJobs.length; i += BATCH_CONCURRENCY) {
    const batch = uniqueJobs.slice(i, i + BATCH_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (jobGroup) => {
        const result = await translateOne(jobGroup.text, apiKey, config);
        return { jobGroup, result };
      }),
    );

    for (let j = 0; j < settled.length; j++) {
      const outcome = settled[j];
      const jobGroup = batch[j];
      const groupSize = jobGroup.indexes.length;
      if (outcome.status === "fulfilled") {
        const translatedText = outcome.value.result.text;
        for (const idx of jobGroup.indexes) {
          results.set(idx, translatedText);
        }
        if (translatedText !== jobGroup.text) translated += groupSize;
        if (outcome.value.result.route === "gateway") {
          gatewaySuccess += groupSize;
        } else {
          directSuccess += groupSize;
        }
      } else {
        for (const idx of jobGroup.indexes) {
          results.set(idx, jobGroup.text);
          failed++;
          failedIndexes.push(idx);
        }
      }
    }
  }

  return { results, translated, failed, failedIndexes, gatewaySuccess, directSuccess };
}

function normalizeImageOutput(text: string): string {
  const trimmed = (text || "").trim();
  if (!trimmed) return "";
  if (/^no[_\s-]*text$/i.test(trimmed)) return "";
  if (/^no readable text$/i.test(trimmed)) return "";
  return trimmed;
}

async function callGroqVision(
  route: TranslationRoute,
  imageUrl: string,
  apiKey: string,
  config: TranslationConfig,
  contextText?: string,
): Promise<string> {
  const url =
    route === "gateway"
      ? buildGatewayUrl(config.gatewayAccountId!, config.gatewayName!)
      : GROQ_DIRECT_URL;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (route === "gateway") {
    if (!isGatewayTranslationEnabled(config)) {
      throw new Error("AI Gateway configuration is incomplete.");
    }
    const maxAttempts = Math.max(1, Math.floor(config.gatewayMaxAttempts ?? GATEWAY_MAX_ATTEMPTS));
    const cacheTtlSeconds = Math.max(0, Math.floor(config.cacheTtlVisionSeconds ?? GATEWAY_CACHE_TTL_SECONDS_VISION));
    headers["cf-aig-authorization"] = `Bearer ${config.gatewayToken}`;
    headers["cf-aig-cache-key"] = await buildGatewayCacheKey("vision", imageUrl, contextText || "");
    headers["cf-aig-cache-ttl"] = String(cacheTtlSeconds);
    headers["cf-aig-request-timeout"] = String(Math.max(250, IMAGE_TRANSLATE_TIMEOUT_MS - 250));
    headers["cf-aig-max-attempts"] = String(maxAttempts);
    headers["cf-aig-collect-log"] = "false";
  }

  const prompt = [
    "Read all visible text in this image and output natural English only.",
    "If source text is non-English, translate it to concise English.",
    "If image has no readable text, return exactly: NO_TEXT",
    "Do not add commentary, labels, or markdown.",
    contextText?.trim()
      ? `Context (may help with acronyms): ${contextText.trim().slice(0, 350)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: estimateImageTranslationMaxTokens(contextText),
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(IMAGE_TRANSLATE_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq vision ${route} ${res.status}: ${body.slice(0, 220)}`);
  }

  const result = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return normalizeImageOutput(result.choices?.[0]?.message?.content || "");
}

async function translateImageOne(
  imageUrl: string,
  apiKey: string,
  config: TranslationConfig,
  contextText?: string,
): Promise<TranslateOneResult> {
  if (isGatewayTranslationEnabled(config)) {
    for (let attempt = 0; attempt < MAX_TRANSLATE_ATTEMPTS; attempt++) {
      try {
        const translated = await callGroqVision("gateway", imageUrl, apiKey, config, contextText);
        return { text: translated, route: "gateway" };
      } catch {
        // fall through
      }
    }
  }

  for (let attempt = 0; attempt < MAX_TRANSLATE_ATTEMPTS; attempt++) {
    try {
      const translated = await callGroqVision("direct", imageUrl, apiKey, config, contextText);
      return { text: translated, route: "direct" };
    } catch {
      // retry
    }
  }

  throw new Error("Image translation failed across gateway and direct paths.");
}

export async function translateImageBatch(
  jobs: ImageTranslationJob[],
  apiKey: string,
  config: TranslationConfig,
): Promise<{
  results: Map<number, string>;
  translated: number;
  failed: number;
  failedIndexes: number[];
  gatewaySuccess: number;
  directSuccess: number;
}> {
  const results = new Map<number, string>();
  let translated = 0;
  let failed = 0;
  const failedIndexes: number[] = [];
  let gatewaySuccess = 0;
  let directSuccess = 0;

  const grouped = new Map<string, { imageUrl: string; contextText?: string; indexes: number[] }>();
  for (const job of jobs) {
    const key = `${job.imageUrl}::${(job.contextText || "").slice(0, 120)}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.indexes.push(job.index);
      continue;
    }
    grouped.set(key, {
      imageUrl: job.imageUrl,
      contextText: job.contextText,
      indexes: [job.index],
    });
  }

  const uniqueJobs = Array.from(grouped.values());
  for (let i = 0; i < uniqueJobs.length; i += IMAGE_BATCH_CONCURRENCY) {
    const batch = uniqueJobs.slice(i, i + IMAGE_BATCH_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (jobGroup) => {
        const result = await translateImageOne(
          jobGroup.imageUrl,
          apiKey,
          config,
          jobGroup.contextText,
        );
        return { jobGroup, result };
      }),
    );

    for (let j = 0; j < settled.length; j++) {
      const outcome = settled[j];
      const jobGroup = batch[j];
      const groupSize = jobGroup.indexes.length;
      if (outcome.status === "fulfilled") {
        const translatedText = normalizeImageOutput(outcome.value.result.text);
        for (const idx of jobGroup.indexes) {
          results.set(idx, translatedText);
        }
        if (translatedText) translated += groupSize;
        if (outcome.value.result.route === "gateway") {
          gatewaySuccess += groupSize;
        } else {
          directSuccess += groupSize;
        }
      } else {
        for (const idx of jobGroup.indexes) {
          failed++;
          failedIndexes.push(idx);
        }
      }
    }
  }

  return { results, translated, failed, failedIndexes, gatewaySuccess, directSuccess };
}
