import { createHash } from "node:crypto";

export enum IntentCategory {
  QUESTION = "question",
  DEFINITION = "definition",
  EXPLANATION = "explanation",
  COMMAND = "command",
  REQUEST = "request",
  INSTRUCTION = "instruction",
  GREETING = "greeting",
  FAREWELL = "farewell",
  THANKS = "thanks",
  APOLOGY = "apology",
  POSITIVE_FEEDBACK = "positive_feedback",
  NEGATIVE_FEEDBACK = "negative_feedback",
  CORRECTION = "correction",
  STATUS_CHECK = "status_check",
  HELP = "help",
  CANCEL = "cancel",
  CONFIRM = "confirm",
  DENY = "deny",
  CAPABILITY_QUERY = "capability",
  PREFERENCE = "preference",
  OPINION = "opinion",
  UNKNOWN = "unknown",
}

export const INTENT_KEYWORDS: Record<IntentCategory, string[]> = {
  [IntentCategory.QUESTION]: ["what", "who", "where", "when", "why", "how"],
  [IntentCategory.DEFINITION]: ["define", "meaning", "what is"],
  [IntentCategory.EXPLANATION]: ["explain", "tell me about", "describe"],
  [IntentCategory.COMMAND]: ["do", "make", "create", "run", "execute"],
  [IntentCategory.REQUEST]: ["please", "can you", "could you", "would you"],
  [IntentCategory.INSTRUCTION]: ["follow", "step", "guide"],
  [IntentCategory.GREETING]: ["hello", "hi", "hey", "good morning"],
  [IntentCategory.FAREWELL]: ["bye", "goodbye", "see you", "later"],
  [IntentCategory.THANKS]: ["thank", "thanks", "appreciate"],
  [IntentCategory.APOLOGY]: ["sorry", "apologize", "my bad"],
  [IntentCategory.POSITIVE_FEEDBACK]: ["great", "awesome", "good job"],
  [IntentCategory.NEGATIVE_FEEDBACK]: ["bad", "wrong", "incorrect"],
  [IntentCategory.CORRECTION]: ["actually", "that's not", "correction"],
  [IntentCategory.STATUS_CHECK]: ["status", "progress", "how is"],
  [IntentCategory.HELP]: ["help", "assist", "support"],
  [IntentCategory.CANCEL]: ["cancel", "stop", "abort", "nevermind"],
  [IntentCategory.CONFIRM]: ["yes", "correct", "confirm", "right"],
  [IntentCategory.DENY]: ["no", "deny", "reject", "wrong"],
  [IntentCategory.CAPABILITY_QUERY]: ["can you", "are you able", "do you"],
  [IntentCategory.PREFERENCE]: ["prefer", "like", "want"],
  [IntentCategory.OPINION]: ["think", "opinion", "recommend"],
  [IntentCategory.UNKNOWN]: [],
};

export enum EntityType {
  PERSON = "person",
  ORGANIZATION = "organization",
  LOCATION = "location",
  DATE = "date",
  TIME = "time",
  DURATION = "duration",
  NUMBER = "number",
  PERCENTAGE = "percentage",
  MONEY = "money",
  EMAIL = "email",
  PHONE = "phone",
  URL = "url",
  FILE_PATH = "file_path",
  CODE_SNIPPET = "code_snippet",
  COMMAND = "command",
  PARAMETER = "parameter",
  PROGRAMMING_LANGUAGE = "programming_language",
  TECHNOLOGY = "technology",
  ERROR_CODE = "error_code",
  VERSION = "version",
  HASHTAG = "hashtag",
  MENTION = "mention",
  UNKNOWN = "unknown",
}

export enum SentimentType {
  VERY_POSITIVE = "very_positive",
  POSITIVE = "positive",
  NEUTRAL = "neutral",
  NEGATIVE = "negative",
  VERY_NEGATIVE = "very_negative",
  MIXED = "mixed",
}

export const SENTIMENT_SCORE: Record<SentimentType, number> = {
  [SentimentType.VERY_POSITIVE]: 1,
  [SentimentType.POSITIVE]: 0.5,
  [SentimentType.NEUTRAL]: 0,
  [SentimentType.NEGATIVE]: -0.5,
  [SentimentType.VERY_NEGATIVE]: -1,
  [SentimentType.MIXED]: 0,
};

export enum LanguageCode {
  EN = "en",
  ES = "es",
  FR = "fr",
  DE = "de",
  IT = "it",
  PT = "pt",
  RU = "ru",
  ZH = "zh",
  JA = "ja",
  KO = "ko",
  AR = "ar",
  HI = "hi",
  NL = "nl",
  PL = "pl",
  TR = "tr",
  UNKNOWN = "unknown",
}

export enum TopicCategory {
  TECHNOLOGY = "technology",
  BUSINESS = "business",
  SCIENCE = "science",
  HEALTH = "health",
  EDUCATION = "education",
  ENTERTAINMENT = "entertainment",
  SPORTS = "sports",
  POLITICS = "politics",
  TRAVEL = "travel",
  FOOD = "food",
  LIFESTYLE = "lifestyle",
  PROGRAMMING = "programming",
  DATA_SCIENCE = "data_science",
  DEVOPS = "devops",
  SECURITY = "security",
  GENERAL = "general",
}

export type ExtractedEntity = {
  text: string;
  entityType: EntityType;
  startPos: number;
  endPos: number;
  confidence: number;
  normalizedValue?: string;
  metadata: Record<string, unknown>;
};

export type IntentResult = {
  primaryIntent: IntentCategory;
  confidence: number;
  secondaryIntents: Array<{ intent: IntentCategory; confidence: number }>;
  matchedKeywords: string[];
  metadata: Record<string, unknown>;
};

export type SentimentResult = {
  sentiment: SentimentType;
  score: number;
  confidence: number;
  positiveWords: string[];
  negativeWords: string[];
  neutralWords: string[];
  metadata: Record<string, unknown>;
};

export type LanguageResult = {
  primaryLanguage: LanguageCode;
  confidence: number;
  detectedLanguages: Array<{ language: LanguageCode; confidence: number }>;
  isMultilingual: boolean;
  metadata: Record<string, unknown>;
};

export type TopicResult = {
  primaryTopic: TopicCategory;
  confidence: number;
  secondaryTopics: Array<{ topic: TopicCategory; confidence: number }>;
  keywords: string[];
  metadata: Record<string, unknown>;
};

export type NLUResult = {
  originalText: string;
  processedText: string;
  intent: IntentResult;
  entities: ExtractedEntity[];
  sentiment: SentimentResult;
  language: LanguageResult;
  topics: TopicResult;
  tokens: string[];
  processedAt: string;
  processingTimeMs: number;
  metadata: Record<string, unknown>;
};

function buildUnknownIntentResult(): IntentResult {
  return {
    primaryIntent: IntentCategory.UNKNOWN,
    confidence: 0.5,
    secondaryIntents: [],
    matchedKeywords: [],
    metadata: {},
  };
}

function buildNeutralSentimentResult(): SentimentResult {
  return {
    sentiment: SentimentType.NEUTRAL,
    score: 0,
    confidence: 0.5,
    positiveWords: [],
    negativeWords: [],
    neutralWords: [],
    metadata: {},
  };
}

function buildUnknownLanguageResult(): LanguageResult {
  return {
    primaryLanguage: LanguageCode.UNKNOWN,
    confidence: 0,
    detectedLanguages: [],
    isMultilingual: false,
    metadata: {},
  };
}

function buildGeneralTopicResult(): TopicResult {
  return {
    primaryTopic: TopicCategory.GENERAL,
    confidence: 0.5,
    secondaryTopics: [],
    keywords: [],
    metadata: {},
  };
}

export class NLUTextPreprocessor {
  static readonly CONTRACTIONS: Record<string, string> = {
    "won't": "will not",
    "can't": "cannot",
    "n't": " not",
    "'re": " are",
    "'s": " is",
    "'d": " would",
    "'ll": " will",
    "'ve": " have",
    "'m": " am",
  };

  static readonly STOP_WORDS = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "as",
    "is",
    "are",
    "was",
    "were",
    "be",
    "have",
    "has",
    "had",
  ]);

  preprocess(
    text: string,
    options: {
      lowercase?: boolean;
      removePunctuation?: boolean;
      expandContractions?: boolean;
      removeStopWords?: boolean;
      removeExtraWhitespace?: boolean;
    } = {},
  ): string {
    if (!text) {
      return "";
    }
    const lowercase = options.lowercase ?? true;
    const removePunctuation = options.removePunctuation ?? false;
    const expandContractions = options.expandContractions ?? true;
    const removeStopWords = options.removeStopWords ?? false;
    const removeExtraWhitespace = options.removeExtraWhitespace ?? true;
    let output = text;
    if (expandContractions) {
      for (const [needle, replacement] of Object.entries(
        NLUTextPreprocessor.CONTRACTIONS,
      )) {
        const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        output = output.replace(new RegExp(escaped, "gi"), replacement);
      }
    }
    if (lowercase) {
      output = output.toLowerCase();
    }
    if (removePunctuation) {
      output = output.replace(/[^\w\s]/g, "");
    }
    if (removeExtraWhitespace) {
      output = output.replace(/\s+/g, " ").trim();
    }
    if (removeStopWords) {
      output = output
        .split(" ")
        .filter((token) => token && !NLUTextPreprocessor.STOP_WORDS.has(token))
        .join(" ");
    }
    return output;
  }

  tokenize(text: string): string[] {
    if (!text) {
      return [];
    }
    return text.toLowerCase().match(/\b\w+\b/g) ?? [];
  }

  sentenceSplit(text: string): string[] {
    if (!text.trim()) {
      return [];
    }
    return text
      .split(/(?<=[.!?])\s+/g)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  removeUrls(text: string): { text: string; urls: string[] } {
    const urls = text.match(/https?:\/\/[^\s]+/gi) ?? [];
    return {
      text: text.replace(/https?:\/\/[^\s]+/gi, "").replace(/\s+/g, " ").trim(),
      urls,
    };
  }

  removeMentions(text: string): { text: string; mentions: string[] } {
    const mentions = text.match(/@\w+/g) ?? [];
    return {
      text: text.replace(/@\w+/g, "").replace(/\s+/g, " ").trim(),
      mentions,
    };
  }

  removeHashtags(text: string): { text: string; hashtags: string[] } {
    const hashtags = text.match(/#\w+/g) ?? [];
    return {
      text: text.replace(/#\w+/g, "").replace(/\s+/g, " ").trim(),
      hashtags,
    };
  }
}

export class NLUIntentClassifier {
  private readonly preprocessor = new NLUTextPreprocessor();
  private readonly customPatterns = new Map<string, string[]>();

  classify(text: string): IntentResult {
    const processed = this.preprocessor.preprocess(text);
    const scores = new Map<IntentCategory, number>();
    const matchedKeywords = new Map<IntentCategory, string[]>();
    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as Array<
      [IntentCategory, string[]]
    >) {
      let score = 0;
      const matched: string[] = [];
      for (const keyword of keywords) {
        const lowered = keyword.toLowerCase();
        const escaped = lowered.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`(?:^|\\W)${escaped}(?:\\W|$)`).test(processed)) {
          score += lowered.length;
          matched.push(keyword);
        }
      }
      if (score > 0) {
        scores.set(intent, score);
        matchedKeywords.set(intent, matched);
      }
    }
    for (const [intentName, patterns] of this.customPatterns.entries()) {
      const customIntent = Object.values(IntentCategory).find(
        (value) => value === intentName,
      );
      if (!customIntent) {
        continue;
      }
      const score = patterns.reduce((accumulator, pattern) => {
        const lowered = pattern.toLowerCase();
        const escaped = lowered.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(?:^|\\W)${escaped}(?:\\W|$)`).test(processed)
          ? accumulator + lowered.length
          : accumulator;
      }, scores.get(customIntent) ?? 0);
      if (score > 0) {
        scores.set(customIntent, score);
      }
    }
    const sorted = [...scores.entries()].sort((left, right) => right[1] - left[1]);
    if (sorted.length === 0) {
      if (text.includes("?")) {
        return {
          ...buildUnknownIntentResult(),
          primaryIntent: IntentCategory.QUESTION,
          confidence: 0.5,
        };
      }
      return buildUnknownIntentResult();
    }
    const [primaryIntent, primaryScore] = sorted[0];
    const maxConfidence = Math.min(primaryScore / 10, 1);
    return {
      primaryIntent,
      confidence: maxConfidence,
      secondaryIntents: sorted.slice(1, 4).map(([intent, score]) => ({
        intent,
        confidence: Math.min(score / 10, 1),
      })),
      matchedKeywords: matchedKeywords.get(primaryIntent) ?? [],
      metadata: {},
    };
  }

  addCustomPattern(intentName: string, patterns: string[]): void {
    this.customPatterns.set(intentName, [...patterns]);
  }
}

export class NLUEntityExtractor {
  static readonly PATTERNS: Record<EntityType, RegExp> = {
    [EntityType.PERSON]: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g,
    [EntityType.ORGANIZATION]: /\b[A-Z][\w&.-]+(?:\s+(?:Inc|LLC|Ltd|Corp|Group|Labs))\b/g,
    [EntityType.LOCATION]: /\b(?:New York|London|Tokyo|Paris|Berlin|Sydney)\b/gi,
    [EntityType.DATE]:
      /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s+\d{4}\b/gi,
    [EntityType.TIME]: /\b\d{1,2}:\d{2}(?::\d{2})?\s?(?:am|pm)?\b/gi,
    [EntityType.DURATION]: /\b\d+\s?(?:ms|s|sec|seconds|minutes|hours|days)\b/gi,
    [EntityType.NUMBER]: /\b\d+(?:\.\d+)?\b/g,
    [EntityType.PERCENTAGE]: /\b\d+(?:\.\d+)?%\b/g,
    [EntityType.MONEY]: /\$\d+(?:\.\d+)?|\b\d+(?:\.\d+)?\s?(?:usd|eur|gbp|dollars?)\b/gi,
    [EntityType.EMAIL]: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    [EntityType.PHONE]: /\b(?:\+\d{1,3}\s?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    [EntityType.URL]: /https?:\/\/[^\s]+/gi,
    [EntityType.FILE_PATH]:
      /(?:[A-Za-z]:[\\/]|\/)(?:[\w.-]+[\\/])*[\w.-]+\.\w+|(?:[\w.-]+[\\/])+[\w.-]+\.\w+/g,
    [EntityType.CODE_SNIPPET]: /`[^`]+`/g,
    [EntityType.COMMAND]: /\/[a-z][\w-]*/gi,
    [EntityType.PARAMETER]: /--?[a-z][\w-]*/gi,
    [EntityType.PROGRAMMING_LANGUAGE]:
      /\b(?:python|javascript|typescript|java|go|rust|ruby|php|kotlin|swift|scala)\b/gi,
    [EntityType.TECHNOLOGY]:
      /\b(?:react|vue|angular|fastapi|django|flask|nodejs|postgresql|redis|kubernetes)\b/gi,
    [EntityType.ERROR_CODE]: /\b(?:E[A-Z_0-9]+|ERR_[A-Z_0-9]+|HTTP\s?\d{3})\b/gi,
    [EntityType.VERSION]: /\bv?\d+\.\d+(?:\.\d+)?(?:-[\w.-]+)?\b/g,
    [EntityType.HASHTAG]: /#\w+/g,
    [EntityType.MENTION]: /@\w+/g,
    [EntityType.UNKNOWN]: /$^/g,
  };

  extract(text: string): ExtractedEntity[] {
    if (!text) {
      return [];
    }
    const entities: ExtractedEntity[] = [];
    for (const [type, pattern] of Object.entries(NLUEntityExtractor.PATTERNS) as Array<
      [EntityType, RegExp]
    >) {
      if (type === EntityType.UNKNOWN) {
        continue;
      }
      const regex = new RegExp(pattern.source, pattern.flags);
      let match = regex.exec(text);
      while (match) {
        entities.push({
          text: match[0],
          entityType: type,
          startPos: match.index,
          endPos: match.index + match[0].length,
          confidence: 0.9,
          metadata: {},
        });
        match = regex.exec(text);
      }
    }
    return this.deduplicate(entities);
  }

  private deduplicate(entities: ExtractedEntity[]): ExtractedEntity[] {
    const sorted = [...entities].sort((left, right) => {
      if (left.startPos !== right.startPos) {
        return left.startPos - right.startPos;
      }
      if (left.endPos !== right.endPos) {
        return left.endPos - right.endPos;
      }
      return right.confidence - left.confidence;
    });
    const output: ExtractedEntity[] = [];
    let lastEnd = -1;
    for (const entity of sorted) {
      if (entity.startPos < lastEnd) {
        continue;
      }
      output.push(entity);
      lastEnd = entity.endPos;
    }
    return output;
  }
}

export class NLUSentimentAnalyzer {
  static readonly POSITIVE_WORDS = new Set([
    "good",
    "great",
    "excellent",
    "amazing",
    "wonderful",
    "fantastic",
    "awesome",
    "love",
    "like",
    "best",
    "happy",
    "perfect",
    "helpful",
    "thanks",
    "appreciate",
  ]);

  static readonly NEGATIVE_WORDS = new Set([
    "bad",
    "terrible",
    "horrible",
    "awful",
    "worst",
    "hate",
    "dislike",
    "wrong",
    "error",
    "mistake",
    "problem",
    "bug",
    "frustrating",
    "annoying",
    "sorry",
  ]);

  static readonly INTENSIFIERS = new Set([
    "very",
    "really",
    "extremely",
    "absolutely",
    "totally",
  ]);

  static readonly NEGATORS = new Set(["not", "no", "never", "neither"]);

  private readonly preprocessor = new NLUTextPreprocessor();

  analyze(text: string): SentimentResult {
    const tokens = this.preprocessor.tokenize(text);
    let positiveScore = 0;
    let negativeScore = 0;
    let negateNext = false;
    const positiveWords: string[] = [];
    const negativeWords: string[] = [];
    const neutralWords: string[] = [];
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (NLUSentimentAnalyzer.NEGATORS.has(token)) {
        negateNext = true;
        continue;
      }
      const intensity =
        index > 0 && NLUSentimentAnalyzer.INTENSIFIERS.has(tokens[index - 1]) ? 1.5 : 1;
      if (NLUSentimentAnalyzer.POSITIVE_WORDS.has(token)) {
        if (negateNext) {
          negativeScore += intensity;
          negativeWords.push(token);
        } else {
          positiveScore += intensity;
          positiveWords.push(token);
        }
        negateNext = false;
        continue;
      }
      if (NLUSentimentAnalyzer.NEGATIVE_WORDS.has(token)) {
        if (negateNext) {
          positiveScore += intensity;
          positiveWords.push(token);
        } else {
          negativeScore += intensity;
          negativeWords.push(token);
        }
        negateNext = false;
        continue;
      }
      neutralWords.push(token);
      if (neutralWords.length % 2 === 0) {
        negateNext = false;
      }
    }
    const total = positiveScore + negativeScore;
    if (total === 0) {
      return buildNeutralSentimentResult();
    }
    const score = (positiveScore - negativeScore) / total;
    let sentiment = SentimentType.NEUTRAL;
    if (score > 0.5) {
      sentiment = SentimentType.VERY_POSITIVE;
    } else if (score > 0.1) {
      sentiment = SentimentType.POSITIVE;
    } else if (score < -0.5) {
      sentiment = SentimentType.VERY_NEGATIVE;
    } else if (score < -0.1) {
      sentiment = SentimentType.NEGATIVE;
    } else if (positiveScore > 0 && negativeScore > 0) {
      sentiment = SentimentType.MIXED;
    }
    return {
      sentiment,
      score,
      confidence: Math.min(total / 5, 1),
      positiveWords,
      negativeWords,
      neutralWords: neutralWords.slice(0, 10),
      metadata: {},
    };
  }
}

export class NLULanguageDetector {
  static readonly LANGUAGE_MARKERS: Record<LanguageCode, Set<string>> = {
    [LanguageCode.EN]: new Set(["the", "is", "are", "was", "were", "have", "has"]),
    [LanguageCode.ES]: new Set(["el", "la", "los", "las", "es", "son", "que"]),
    [LanguageCode.FR]: new Set(["le", "la", "les", "est", "sont", "avec"]),
    [LanguageCode.DE]: new Set(["der", "die", "das", "ist", "sind", "ein"]),
    [LanguageCode.IT]: new Set(["il", "la", "i", "le", "è", "sono"]),
    [LanguageCode.PT]: new Set(["o", "a", "os", "as", "é", "são"]),
    [LanguageCode.RU]: new Set(["и", "в", "не", "на"]),
    [LanguageCode.ZH]: new Set(["的", "是", "在", "和"]),
    [LanguageCode.JA]: new Set(["です", "ます", "する"]),
    [LanguageCode.KO]: new Set(["입니다", "그리고", "하는"]),
    [LanguageCode.AR]: new Set(["ال", "في", "من"]),
    [LanguageCode.HI]: new Set(["है", "और", "के"]),
    [LanguageCode.NL]: new Set(["de", "het", "een", "is"]),
    [LanguageCode.PL]: new Set(["i", "w", "na", "to"]),
    [LanguageCode.TR]: new Set(["ve", "bir", "bu", "için"]),
    [LanguageCode.UNKNOWN]: new Set(),
  };

  detect(text: string): LanguageResult {
    if (!text.trim()) {
      return buildUnknownLanguageResult();
    }
    const words = new Set(text.toLowerCase().split(/\s+/g));
    const scores = new Map<LanguageCode, number>();
    for (const [language, markers] of Object.entries(
      NLULanguageDetector.LANGUAGE_MARKERS,
    ) as Array<[LanguageCode, Set<string>]>) {
      if (language === LanguageCode.UNKNOWN) {
        continue;
      }
      let score = 0;
      for (const marker of markers) {
        if (words.has(marker)) {
          score += 1;
        }
      }
      if (score > 0) {
        scores.set(language, score);
      }
    }
    if (scores.size === 0) {
      return {
        primaryLanguage: LanguageCode.EN,
        confidence: 0.3,
        detectedLanguages: [{ language: LanguageCode.EN, confidence: 0.3 }],
        isMultilingual: false,
        metadata: {},
      };
    }
    const sorted = [...scores.entries()].sort((left, right) => right[1] - left[1]);
    const total = sorted.reduce((sum, [, value]) => sum + value, 0);
    const [primaryLanguage, topScore] = sorted[0];
    return {
      primaryLanguage,
      confidence: total > 0 ? topScore / total : 0.5,
      detectedLanguages: sorted.map(([language, score]) => ({
        language,
        confidence: total > 0 ? score / total : 0,
      })),
      isMultilingual:
        sorted.length > 1 &&
        sorted[1][1] > 1 &&
        sorted[1][1] / sorted[0][1] >= 0.5,
      metadata: {},
    };
  }
}

export class NLUTopicClassifier {
  static readonly TOPIC_KEYWORDS: Record<TopicCategory, Set<string>> = {
    [TopicCategory.PROGRAMMING]: new Set([
      "code",
      "programming",
      "function",
      "variable",
      "class",
      "api",
      "debug",
      "syntax",
      "algorithm",
    ]),
    [TopicCategory.TECHNOLOGY]: new Set([
      "software",
      "hardware",
      "computer",
      "technology",
      "network",
      "internet",
      "cloud",
      "server",
      "database",
    ]),
    [TopicCategory.DATA_SCIENCE]: new Set([
      "data",
      "machine",
      "learning",
      "model",
      "statistics",
      "neural",
      "prediction",
    ]),
    [TopicCategory.DEVOPS]: new Set([
      "deploy",
      "docker",
      "kubernetes",
      "pipeline",
      "infrastructure",
      "terraform",
      "jenkins",
    ]),
    [TopicCategory.SECURITY]: new Set([
      "security",
      "authentication",
      "authorization",
      "password",
      "token",
      "vulnerability",
      "attack",
    ]),
    [TopicCategory.BUSINESS]: new Set([
      "business",
      "market",
      "sales",
      "revenue",
      "customer",
      "strategy",
    ]),
    [TopicCategory.EDUCATION]: new Set([
      "learn",
      "study",
      "course",
      "tutorial",
      "lesson",
      "teach",
    ]),
    [TopicCategory.SCIENCE]: new Set(["science", "research", "experiment", "physics", "biology"]),
    [TopicCategory.HEALTH]: new Set(["health", "exercise", "fitness", "diet", "sleep"]),
    [TopicCategory.ENTERTAINMENT]: new Set(["movie", "music", "show", "game", "series"]),
    [TopicCategory.SPORTS]: new Set(["sport", "match", "team", "league", "score"]),
    [TopicCategory.POLITICS]: new Set(["policy", "government", "election", "politics"]),
    [TopicCategory.TRAVEL]: new Set(["travel", "flight", "hotel", "destination", "trip"]),
    [TopicCategory.FOOD]: new Set(["food", "recipe", "cook", "dish", "meal"]),
    [TopicCategory.LIFESTYLE]: new Set(["life", "habit", "routine", "lifestyle"]),
    [TopicCategory.GENERAL]: new Set(),
  };

  private readonly preprocessor = new NLUTextPreprocessor();

  classify(text: string): TopicResult {
    const tokens = new Set(this.preprocessor.tokenize(text));
    const scores = new Map<TopicCategory, number>();
    const keywords: string[] = [];
    for (const [topic, topicKeywords] of Object.entries(
      NLUTopicClassifier.TOPIC_KEYWORDS,
    ) as Array<[TopicCategory, Set<string>]>) {
      if (topic === TopicCategory.GENERAL) {
        continue;
      }
      let score = 0;
      for (const keyword of topicKeywords) {
        if (tokens.has(keyword)) {
          score += 1;
          keywords.push(keyword);
        }
      }
      if (score > 0) {
        scores.set(topic, score);
      }
    }
    if (scores.size === 0) {
      return buildGeneralTopicResult();
    }
    const sorted = [...scores.entries()].sort((left, right) => right[1] - left[1]);
    const total = sorted.reduce((sum, [, value]) => sum + value, 0);
    const [primaryTopic, topScore] = sorted[0];
    return {
      primaryTopic,
      confidence: total > 0 ? topScore / total : 0.5,
      secondaryTopics: sorted.slice(1, 4).map(([topic, score]) => ({
        topic,
        confidence: total > 0 ? score / total : 0,
      })),
      keywords: [...new Set(keywords)].slice(0, 10),
      metadata: {},
    };
  }
}

export class NLUTextSimilarity {
  private readonly preprocessor = new NLUTextPreprocessor();

  jaccardSimilarity(left: string, right: string): number {
    const leftTokens = new Set(this.preprocessor.tokenize(left));
    const rightTokens = new Set(this.preprocessor.tokenize(right));
    if (leftTokens.size === 0 || rightTokens.size === 0) {
      return 0;
    }
    const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
    const union = new Set([...leftTokens, ...rightTokens]).size;
    return union > 0 ? intersection / union : 0;
  }

  cosineSimilarity(left: string, right: string): number {
    const leftTokens = this.preprocessor.tokenize(left);
    const rightTokens = this.preprocessor.tokenize(right);
    const vocabulary = new Set([...leftTokens, ...rightTokens]);
    if (vocabulary.size === 0) {
      return 0;
    }
    const leftVector = new Map<string, number>();
    const rightVector = new Map<string, number>();
    for (const token of vocabulary) {
      leftVector.set(token, leftTokens.filter((entry) => entry === token).length);
      rightVector.set(token, rightTokens.filter((entry) => entry === token).length);
    }
    let dotProduct = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (const token of vocabulary) {
      const leftValue = leftVector.get(token) ?? 0;
      const rightValue = rightVector.get(token) ?? 0;
      dotProduct += leftValue * rightValue;
      leftNorm += leftValue ** 2;
      rightNorm += rightValue ** 2;
    }
    if (leftNorm === 0 || rightNorm === 0) {
      return 0;
    }
    return dotProduct / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
  }

  levenshteinDistance(left: string, right: string): number {
    if (left === right) {
      return 0;
    }
    if (left.length === 0) {
      return right.length;
    }
    if (right.length === 0) {
      return left.length;
    }
    const matrix = Array.from({ length: left.length + 1 }, () =>
      new Array<number>(right.length + 1).fill(0),
    );
    for (let row = 0; row <= left.length; row += 1) {
      matrix[row][0] = row;
    }
    for (let column = 0; column <= right.length; column += 1) {
      matrix[0][column] = column;
    }
    for (let row = 1; row <= left.length; row += 1) {
      for (let column = 1; column <= right.length; column += 1) {
        const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
        matrix[row][column] = Math.min(
          matrix[row - 1][column] + 1,
          matrix[row][column - 1] + 1,
          matrix[row - 1][column - 1] + substitutionCost,
        );
      }
    }
    return matrix[left.length][right.length];
  }

  normalizedLevenshtein(left: string, right: string): number {
    const maxLength = Math.max(left.length, right.length);
    if (maxLength === 0) {
      return 1;
    }
    return 1 - this.levenshteinDistance(left, right) / maxLength;
  }
}

type CachedNLUResult = {
  result: NLUResult;
  expiresAt: number;
};

export class NLUPipeline {
  readonly preprocessor = new NLUTextPreprocessor();
  readonly intentClassifier = new NLUIntentClassifier();
  readonly entityExtractor = new NLUEntityExtractor();
  readonly sentimentAnalyzer = new NLUSentimentAnalyzer();
  readonly languageDetector = new NLULanguageDetector();
  readonly topicClassifier = new NLUTopicClassifier();
  readonly textSimilarity = new NLUTextSimilarity();
  private readonly cache = new Map<string, CachedNLUResult>();
  private readonly cacheTtlMs: number;

  constructor(cacheTtlMs = 300_000) {
    this.cacheTtlMs = cacheTtlMs;
  }

  analyze(text: string, useCache = true): NLUResult {
    if (!text.trim()) {
      return this.emptyResult(text);
    }
    const cacheKey = createHash("md5").update(text).digest("hex");
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt >= Date.now()) {
        return cached.result;
      }
      if (cached && cached.expiresAt < Date.now()) {
        this.cache.delete(cacheKey);
      }
    }
    const startedAt = Date.now();
    const processedText = this.preprocessor.preprocess(text);
    const output: NLUResult = {
      originalText: text,
      processedText,
      intent: this.intentClassifier.classify(text),
      entities: this.entityExtractor.extract(text),
      sentiment: this.sentimentAnalyzer.analyze(text),
      language: this.languageDetector.detect(text),
      topics: this.topicClassifier.classify(text),
      tokens: this.preprocessor.tokenize(text),
      processedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startedAt,
      metadata: {},
    };
    if (useCache) {
      this.cache.set(cacheKey, {
        result: output,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
    }
    return output;
  }

  clearCache(): number {
    const count = this.cache.size;
    this.cache.clear();
    return count;
  }

  getStats(): Record<string, unknown> {
    return {
      cacheSize: this.cache.size,
      cacheTtlMs: this.cacheTtlMs,
    };
  }

  private emptyResult(text: string): NLUResult {
    return {
      originalText: text,
      processedText: "",
      intent: buildUnknownIntentResult(),
      entities: [],
      sentiment: buildNeutralSentimentResult(),
      language: buildUnknownLanguageResult(),
      topics: buildGeneralTopicResult(),
      tokens: [],
      processedAt: new Date().toISOString(),
      processingTimeMs: 0,
      metadata: {},
    };
  }
}