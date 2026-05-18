type VocabularyLevel = 'basic' | 'intermediate' | 'advanced';

export type LingoAnalysis = {
  userId: string;
  detectedEmotion: string;
  slangDetected: string[];
  vocabularyLevel: VocabularyLevel;
  topics: string[];
  tokenCount: number;
  analyzedAt: string;
};

export type LingoProfile = {
  userId: string;
  primaryEmotion: string;
  slangFrequency: Record<string, number>;
  vocabularyLevel: VocabularyLevel;
  commonTopics: string[];
  interactionCount: number;
  firstSeen: string;
  lastUpdated: string;
};

const EMOTION_KEYWORDS: Record<string, string[]> = {
  happy: ['happy', 'great', 'awesome', 'excited', 'love', 'amazing'],
  frustrated: ['frustrated', 'annoyed', 'stuck', 'blocked', 'angry', 'hate'],
  curious: ['curious', 'wonder', 'how', 'why', 'question', 'explore'],
  tired: ['tired', 'exhausted', 'sleepy', 'drained', 'burned', 'fatigued'],
  neutral: [],
};

const SLANG_TERMS = [
  'yo',
  'fam',
  'bro',
  'bruh',
  'ngl',
  'fr',
  'sus',
  'lit',
  'bet',
  'imo',
  'idk',
  'omg',
];

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'that',
  'this',
  'with',
  'from',
  'have',
  'will',
  'would',
  'there',
  'about',
  'your',
  'when',
  'where',
  'what',
  'which',
  'they',
  'them',
  'you',
  'are',
  'was',
  'were',
  'been',
  'into',
  'just',
  'also',
  'some',
  'more',
  'need',
  'should',
  'could',
  'like',
  'than',
  'then',
  'only',
  'very',
]);

function tokenize(input: string): string[] {
  const tokens = input
    .toLowerCase()
    .match(/[a-z0-9']+/g);
  return tokens ?? [];
}

function detectEmotion(tokens: string[]): string {
  let bestEmotion = 'neutral';
  let bestScore = 0;

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    if (keywords.length === 0) {
      continue;
    }
    let score = 0;
    for (const token of tokens) {
      if (keywords.includes(token)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestEmotion = emotion;
    }
  }

  return bestEmotion;
}

function detectSlang(tokens: string[]): string[] {
  const output: string[] = [];
  for (const token of tokens) {
    if (SLANG_TERMS.includes(token) && !output.includes(token)) {
      output.push(token);
    }
  }
  return output;
}

function detectVocabularyLevel(tokens: string[]): VocabularyLevel {
  if (tokens.length === 0) {
    return 'basic';
  }

  const uniqueCount = new Set(tokens).size;
  const uniqueRatio = uniqueCount / tokens.length;
  const averageLength =
    tokens.reduce((total, token) => total + token.length, 0) / tokens.length;

  if (uniqueRatio >= 0.6 || averageLength >= 6) {
    return 'advanced';
  }
  if (uniqueRatio >= 0.4 || averageLength >= 4.5) {
    return 'intermediate';
  }
  return 'basic';
}

function detectTopics(tokens: string[], maxTopics: number = 5): string[] {
  const frequency = new Map<string, number>();
  for (const token of tokens) {
    if (token.length < 4 || STOP_WORDS.has(token)) {
      continue;
    }
    frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }
  return [...frequency.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, maxTopics)
    .map(([topic]) => topic);
}

function cloneFrequencyMap(
  frequency: Record<string, number>,
): Record<string, number> {
  return Object.fromEntries(Object.entries(frequency));
}

function cloneProfile(profile: LingoProfile): LingoProfile {
  return {
    ...profile,
    slangFrequency: cloneFrequencyMap(profile.slangFrequency),
    commonTopics: [...profile.commonTopics],
  };
}

export class LingoAdapter {
  private readonly profiles = new Map<string, LingoProfile>();
  private readonly topicFrequency = new Map<string, Map<string, number>>();

  analyze(input: string, userId: string = 'default'): LingoAnalysis {
    const analyzedAt = new Date().toISOString();
    const tokens = tokenize(input);
    const detectedEmotion = detectEmotion(tokens);
    const slangDetected = detectSlang(tokens);
    const vocabularyLevel = detectVocabularyLevel(tokens);
    const topics = detectTopics(tokens);
    return {
      userId,
      detectedEmotion,
      slangDetected,
      vocabularyLevel,
      topics,
      tokenCount: tokens.length,
      analyzedAt,
    };
  }

  evolveProfile(userId: string, analysis: LingoAnalysis): LingoProfile {
    const now = analysis.analyzedAt;
    const existing = this.profiles.get(userId);
    const profile: LingoProfile =
      existing ?? {
        userId,
        primaryEmotion: 'neutral',
        slangFrequency: {},
        vocabularyLevel: 'basic',
        commonTopics: [],
        interactionCount: 0,
        firstSeen: now,
        lastUpdated: now,
      };

    profile.primaryEmotion = analysis.detectedEmotion;
    profile.vocabularyLevel = analysis.vocabularyLevel;
    profile.interactionCount += 1;
    profile.lastUpdated = now;

    for (const slang of analysis.slangDetected) {
      profile.slangFrequency[slang] = (profile.slangFrequency[slang] ?? 0) + 1;
    }

    const topicCounts = this.topicFrequency.get(userId) ?? new Map<string, number>();
    for (const topic of analysis.topics) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
    this.topicFrequency.set(userId, topicCounts);
    profile.commonTopics = [...topicCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5)
      .map(([topic]) => topic);

    this.profiles.set(userId, profile);
    return cloneProfile(profile);
  }

  analyzeAndEvolve(input: string, userId: string = 'default'): LingoAnalysis {
    const analysis = this.analyze(input, userId);
    this.evolveProfile(userId, analysis);
    return analysis;
  }

  getProfile(userId: string = 'default'): LingoProfile | undefined {
    const profile = this.profiles.get(userId);
    return profile ? cloneProfile(profile) : undefined;
  }

  getProfiles(): LingoProfile[] {
    return [...this.profiles.values()].map((profile) => cloneProfile(profile));
  }
}

function topSlang(
  slangFrequency: Record<string, number>,
  limit: number = 5,
): [string, number][] {
  return Object.entries(slangFrequency)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit);
}

export function renderLingoProfile(
  userId: string,
  profile?: LingoProfile,
): string {
  if (!profile) {
    return [
      `LINGO PROFILE: ${userId}`,
      'No profile found.',
      'Start interacting to build your linguistic profile.',
    ].join('\n');
  }

  const lines: string[] = [
    `LINGO PROFILE: ${userId}`,
    `Primary Emotion: ${profile.primaryEmotion}`,
    `Vocabulary Level: ${profile.vocabularyLevel}`,
    `Interactions: ${profile.interactionCount}`,
    'Common Topics:',
  ];

  if (profile.commonTopics.length === 0) {
    lines.push('- (none detected yet)');
  } else {
    for (const topic of profile.commonTopics.slice(0, 5)) {
      lines.push(`- ${topic}`);
    }
  }

  lines.push('Top Slang Terms:');
  const slang = topSlang(profile.slangFrequency);
  if (slang.length === 0) {
    lines.push('- (none detected yet)');
  } else {
    for (const [term, count] of slang) {
      lines.push(`- ${term}: ${count}`);
    }
  }

  lines.push(`First Seen: ${profile.firstSeen}`);
  lines.push(`Last Updated: ${profile.lastUpdated}`);
  return lines.join('\n');
}