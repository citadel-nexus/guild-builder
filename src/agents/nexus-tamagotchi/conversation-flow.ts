import { randomUUID } from "node:crypto";

export type ConversationRole = "user" | "assistant" | "system";

export type ConversationTurn = {
  id: string;
  role: ConversationRole;
  content: string;
  timestamp: string;
  tokensUsed: number;
  intent?: string;
  sentiment: "positive" | "negative" | "neutral";
  topics: string[];
  entitiesMentioned: string[];
  responseTimeMs?: number;
  qualityScore: number;
  metadata: Record<string, unknown>;
};

export type ConversationState = {
  stateName: string;
  activeTopics: string[];
  pendingQuestions: string[];
  pendingTasks: string[];
  userIntent: string;
  sentimentTrend: "improving" | "declining" | "stable";
  engagementLevel: number;
  contextTokens: number;
  turnCount: number;
  lastActivity?: string;
};

export type ConversationSummary = {
  conversationId: string;
  totalTurns: number;
  durationMinutes: number;
  topicsDiscussed: string[];
  sentimentAverage: "positive" | "negative" | "neutral";
  keyPoints: string[];
  actionItems: string[];
  entitiesReferenced: string[];
  xpEarned: number;
  qualityScore: number;
};

export class IntentClassifier {
  static readonly INTENT_PATTERNS: Record<string, string[]> = {
    greeting: [
      "hello",
      "hi",
      "hey",
      "good morning",
      "good evening",
      "howdy",
      "greetings",
    ],
    farewell: [
      "goodbye",
      "bye",
      "see you",
      "later",
      "quit",
      "exit",
      "thanks for",
    ],
    question: [
      "what",
      "who",
      "where",
      "when",
      "why",
      "how",
      "can you",
      "could you",
      "do you",
    ],
    request: ["please", "can you", "could you", "help me", "i need", "i want"],
    feedback: [
      "great",
      "awesome",
      "terrible",
      "bad",
      "good job",
      "well done",
      "not helpful",
    ],
    clarification: ["what do you mean", "i don't understand", "explain", "clarify"],
    status: ["status", "how are you", "what's up", "how is it going"],
    help: ["help", "assist", "support", "guide"],
    task: ["create", "make", "build", "write", "generate", "implement", "add"],
    search: ["find", "search", "look for", "locate", "where is"],
    learn: ["learn", "remember", "teach", "note that", "don't forget"],
  };

  classify(text: string): string {
    const normalized = text.toLowerCase();
    let bestIntent = "statement";
    let bestScore = 0;
    for (const [intent, patterns] of Object.entries(
      IntentClassifier.INTENT_PATTERNS,
    )) {
      const score = patterns.reduce(
        (total, pattern) => (normalized.includes(pattern) ? total + 1 : total),
        0,
      );
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }
    if (bestScore === 0 && normalized.includes("?")) {
      return "question";
    }
    return bestIntent;
  }
}

export class SentimentAnalyzer {
  static readonly POSITIVE_WORDS = [
    "good",
    "great",
    "excellent",
    "amazing",
    "wonderful",
    "fantastic",
    "awesome",
    "love",
    "like",
    "happy",
    "pleased",
    "thanks",
    "thank",
    "appreciate",
    "helpful",
    "perfect",
    "brilliant",
    "nice",
    "cool",
    "yes",
    "agree",
    "correct",
    "right",
  ];

  static readonly NEGATIVE_WORDS = [
    "bad",
    "terrible",
    "awful",
    "horrible",
    "hate",
    "dislike",
    "angry",
    "frustrated",
    "disappointed",
    "annoying",
    "useless",
    "wrong",
    "incorrect",
    "no",
    "disagree",
    "confused",
    "confusing",
    "unclear",
    "unhelpful",
    "poor",
    "worse",
    "worst",
  ];

  analyze(text: string): { sentiment: "positive" | "negative" | "neutral"; confidence: number } {
    const normalized = text.toLowerCase();
    const positiveCount = SentimentAnalyzer.POSITIVE_WORDS.reduce(
      (total, word) => (normalized.includes(word) ? total + 1 : total),
      0,
    );
    const negativeCount = SentimentAnalyzer.NEGATIVE_WORDS.reduce(
      (total, word) => (normalized.includes(word) ? total + 1 : total),
      0,
    );
    const total = positiveCount + negativeCount;
    if (total === 0) {
      return { sentiment: "neutral", confidence: 0.5 };
    }
    if (positiveCount > negativeCount) {
      return { sentiment: "positive", confidence: positiveCount / total };
    }
    if (negativeCount > positiveCount) {
      return { sentiment: "negative", confidence: negativeCount / total };
    }
    return { sentiment: "neutral", confidence: 0.5 };
  }
}

export class TopicDetector {
  static readonly TOPIC_KEYWORDS: Record<string, string[]> = {
    technology: [
      "code",
      "programming",
      "software",
      "computer",
      "ai",
      "machine learning",
      "api",
      "database",
    ],
    business: [
      "business",
      "company",
      "market",
      "sales",
      "revenue",
      "profit",
      "customer",
    ],
    learning: [
      "learn",
      "study",
      "course",
      "education",
      "skill",
      "training",
      "teach",
    ],
    productivity: [
      "task",
      "todo",
      "schedule",
      "time",
      "efficiency",
      "workflow",
      "organize",
    ],
    personal: ["feel", "think", "believe", "life", "family", "friend", "hobby"],
    health: [
      "health",
      "exercise",
      "fitness",
      "diet",
      "sleep",
      "wellness",
      "stress",
    ],
    creative: ["design", "art", "write", "create", "music", "story", "idea"],
    problem_solving: ["problem", "issue", "bug", "fix", "solve", "debug", "error"],
    planning: [
      "plan",
      "goal",
      "project",
      "milestone",
      "deadline",
      "roadmap",
      "strategy",
    ],
  };

  detect(text: string): string[] {
    const normalized = text.toLowerCase();
    const topics = Object.entries(TopicDetector.TOPIC_KEYWORDS)
      .filter(([, keywords]) =>
        keywords.some((keyword) => normalized.includes(keyword)),
      )
      .map(([topic]) => topic);
    return topics.length > 0 ? topics : ["general"];
  }
}

function defaultConversationState(): ConversationState {
  return {
    stateName: "default",
    activeTopics: [],
    pendingQuestions: [],
    pendingTasks: [],
    userIntent: "unknown",
    sentimentTrend: "stable",
    engagementLevel: 0.5,
    contextTokens: 0,
    turnCount: 0,
  };
}

export type PersistedConversation = {
  id: string;
  turns: Array<{
    id: string;
    role: ConversationRole;
    content: string;
    timestamp: string;
    intent?: string;
    sentiment: "positive" | "negative" | "neutral";
    topics: string[];
  }>;
  state: {
    stateName: string;
    activeTopics: string[];
    turnCount: number;
  };
};

export type ConversationFlowManagerOptions = {
  maxContextTurns?: number;
  maxContextTokens?: number;
  now?: () => Date;
  conversationIdFactory?: () => string;
  persistConversation?: (
    payload: PersistedConversation,
  ) => void | Promise<void>;
};

export class ConversationFlowManager {
  static readonly MAX_CONTEXT_TURNS = 200;

  static readonly MAX_CONTEXT_TOKENS = 80_000;

  private readonly intentClassifier = new IntentClassifier();

  private readonly sentimentAnalyzer = new SentimentAnalyzer();

  private readonly topicDetector = new TopicDetector();

  private readonly now: () => Date;

  private readonly conversationIdFactory: () => string;

  private readonly persistConversation?: (
    payload: PersistedConversation,
  ) => void | Promise<void>;

  private readonly maxContextTurns: number;

  private readonly maxContextTokens: number;

  private currentConversationId: string;

  private turns: ConversationTurn[] = [];

  private state: ConversationState = defaultConversationState();

  private readonly conversationSummaries: ConversationSummary[] = [];

  constructor(options: ConversationFlowManagerOptions = {}) {
    this.maxContextTurns =
      options.maxContextTurns ?? ConversationFlowManager.MAX_CONTEXT_TURNS;
    this.maxContextTokens =
      options.maxContextTokens ?? ConversationFlowManager.MAX_CONTEXT_TOKENS;
    this.now = options.now ?? (() => new Date());
    this.conversationIdFactory = options.conversationIdFactory ?? randomUUID;
    this.persistConversation = options.persistConversation;
    this.currentConversationId = this.conversationIdFactory();
  }

  addTurn(
    role: ConversationRole,
    content: string,
    responseTimeMs?: number,
  ): ConversationTurn {
    const intent =
      role === "user" ? this.intentClassifier.classify(content) : undefined;
    const sentiment = this.sentimentAnalyzer.analyze(content).sentiment;
    const topics = this.topicDetector.detect(content);
    const tokensUsed = Math.max(1, Math.ceil(content.length / 4));
    const turn: ConversationTurn = {
      id: randomUUID(),
      role,
      content,
      timestamp: this.now().toISOString(),
      tokensUsed,
      intent,
      sentiment,
      topics,
      entitiesMentioned: [],
      responseTimeMs,
      qualityScore: 0,
      metadata: {},
    };
    this.turns.push(turn);
    this.updateState(turn);
    this.pruneContext();
    return { ...turn, topics: [...turn.topics], metadata: { ...turn.metadata } };
  }

  getContext(maxTurns = 10): Array<{ role: ConversationRole; content: string }> {
    const recent = this.turns.slice(-Math.max(1, maxTurns));
    return recent.map((turn) => ({ role: turn.role, content: turn.content }));
  }

  getState(): ConversationState {
    return {
      ...this.state,
      activeTopics: [...this.state.activeTopics],
      pendingQuestions: [...this.state.pendingQuestions],
      pendingTasks: [...this.state.pendingTasks],
    };
  }

  markQuestionAnswered(question: string): void {
    this.state.pendingQuestions = this.state.pendingQuestions.filter(
      (pendingQuestion) => pendingQuestion !== question,
    );
  }

  markTaskCompleted(task: string): void {
    this.state.pendingTasks = this.state.pendingTasks.filter(
      (pendingTask) => pendingTask !== task,
    );
  }

  endConversation(): ConversationSummary {
    if (this.turns.length === 0) {
      return {
        conversationId: this.currentConversationId,
        totalTurns: 0,
        durationMinutes: 0,
        topicsDiscussed: [],
        sentimentAverage: "neutral",
        keyPoints: [],
        actionItems: [],
        entitiesReferenced: [],
        xpEarned: 0,
        qualityScore: 0,
      };
    }
    const firstTurnTimestamp = Date.parse(this.turns[0].timestamp);
    const lastTurnTimestamp = Date.parse(this.turns[this.turns.length - 1].timestamp);
    const durationMinutes = Math.max(
      0,
      (lastTurnTimestamp - firstTurnTimestamp) / 1000 / 60,
    );
    const topicsDiscussed = Array.from(
      new Set(this.turns.flatMap((turn) => turn.topics)),
    );
    const sentimentAverage = this.calculateAverageSentiment();
    const xpEarned = this.turns.length * 5 + Math.floor(this.state.engagementLevel * 20);
    const summary: ConversationSummary = {
      conversationId: this.currentConversationId,
      totalTurns: this.turns.length,
      durationMinutes,
      topicsDiscussed,
      sentimentAverage,
      keyPoints: [],
      actionItems: [...this.state.pendingTasks],
      entitiesReferenced: [],
      xpEarned,
      qualityScore: this.state.engagementLevel,
    };
    this.conversationSummaries.push(summary);
    this.persistCurrentConversation();
    this.currentConversationId = this.conversationIdFactory();
    this.turns = [];
    this.state = defaultConversationState();
    return {
      ...summary,
      topicsDiscussed: [...summary.topicsDiscussed],
      keyPoints: [...summary.keyPoints],
      actionItems: [...summary.actionItems],
      entitiesReferenced: [...summary.entitiesReferenced],
    };
  }

  getSummaries(): ConversationSummary[] {
    return this.conversationSummaries.map((summary) => ({
      ...summary,
      topicsDiscussed: [...summary.topicsDiscussed],
      keyPoints: [...summary.keyPoints],
      actionItems: [...summary.actionItems],
      entitiesReferenced: [...summary.entitiesReferenced],
    }));
  }

  getStats(): Record<string, unknown> {
    return {
      currentConversationId: this.currentConversationId,
      currentTurns: this.turns.length,
      currentState: this.state.stateName,
      activeTopics: [...this.state.activeTopics],
      engagementLevel: this.state.engagementLevel,
      sentimentTrend: this.state.sentimentTrend,
      pendingQuestions: this.state.pendingQuestions.length,
      pendingTasks: this.state.pendingTasks.length,
      totalConversations: this.conversationSummaries.length,
    };
  }

  private updateState(turn: ConversationTurn): void {
    this.state.turnCount += 1;
    this.state.contextTokens += turn.tokensUsed;
    this.state.lastActivity = turn.timestamp;
    for (const topic of turn.topics) {
      if (!this.state.activeTopics.includes(topic)) {
        this.state.activeTopics.push(topic);
      }
    }
    this.state.activeTopics = this.state.activeTopics.slice(-5);

    if (turn.intent) {
      this.state.userIntent = turn.intent;
      if (turn.intent === "greeting") {
        this.state.stateName = "greeting";
      } else if (turn.intent === "farewell") {
        this.state.stateName = "farewell";
      } else if (turn.intent === "question") {
        this.state.stateName = "question";
        if (!this.state.pendingQuestions.includes(turn.content)) {
          this.state.pendingQuestions.push(turn.content);
        }
      } else if (turn.intent === "task") {
        this.state.stateName = "task";
        if (!this.state.pendingTasks.includes(turn.content)) {
          this.state.pendingTasks.push(turn.content);
        }
      }
    }

    const recentSentiments = this.turns.slice(-5).map((item) => item.sentiment);
    const positiveCount = recentSentiments.filter(
      (sentiment) => sentiment === "positive",
    ).length;
    const negativeCount = recentSentiments.filter(
      (sentiment) => sentiment === "negative",
    ).length;
    if (positiveCount > negativeCount) {
      this.state.sentimentTrend = "improving";
    } else if (negativeCount > positiveCount) {
      this.state.sentimentTrend = "declining";
    } else {
      this.state.sentimentTrend = "stable";
    }

    const recentTurns = this.turns.slice(-5);
    const averageLength =
      recentTurns.reduce((total, item) => total + item.content.length, 0) /
      Math.max(1, recentTurns.length);
    this.state.engagementLevel = Math.min(1, averageLength / 200);
  }

  private pruneContext(): void {
    while (this.turns.length > this.maxContextTurns) {
      const removed = this.turns.shift();
      if (!removed) {
        continue;
      }
      this.state.contextTokens -= removed.tokensUsed;
    }
    while (this.state.contextTokens > this.maxContextTokens && this.turns.length > 0) {
      const removed = this.turns.shift();
      if (!removed) {
        continue;
      }
      this.state.contextTokens -= removed.tokensUsed;
    }
    this.state.contextTokens = Math.max(0, this.state.contextTokens);
  }

  private calculateAverageSentiment(): "positive" | "negative" | "neutral" {
    const sentiments = this.turns.map((turn) => turn.sentiment);
    const positiveRatio =
      sentiments.filter((sentiment) => sentiment === "positive").length /
      Math.max(1, sentiments.length);
    if (positiveRatio > 0.5) {
      return "positive";
    }
    if (positiveRatio < 0.3) {
      return "negative";
    }
    return "neutral";
  }

  private persistCurrentConversation(): void {
    if (!this.persistConversation || this.turns.length === 0) {
      return;
    }
    const payload: PersistedConversation = {
      id: this.currentConversationId,
      turns: this.turns.map((turn) => ({
        id: turn.id,
        role: turn.role,
        content: turn.content,
        timestamp: turn.timestamp,
        intent: turn.intent,
        sentiment: turn.sentiment,
        topics: [...turn.topics],
      })),
      state: {
        stateName: this.state.stateName,
        activeTopics: [...this.state.activeTopics],
        turnCount: this.state.turnCount,
      },
    };
    void this.persistConversation(payload);
  }
}
