export type RuntimeReflexPattern = {
  name: string;
  patterns: string[];
  responseTemplate: string;
  capsRating: string;
  cooldownSeconds: number;
  energyCost: number;
  xpAward: number;
};

export type ReflexResult = {
  triggered: boolean;
  patternName?: string;
  response?: string;
  xpAwarded: number;
  timestamp: string;
};

export class ReflexEngine {
  readonly patterns: Record<string, RuntimeReflexPattern>;
  readonly triggerHistory: ReflexResult[] = [];

  private readonly lastTriggerTimes = new Map<string, number>();

  constructor(private readonly agentName: string = 'Aurora') {
    this.patterns = this.initPatterns();
  }

  tryReflex(userInput: string): ReflexResult {
    const normalized = userInput.toLowerCase().trim();
    const now = Date.now();

    for (const [name, pattern] of Object.entries(this.patterns)) {
      const triggered = pattern.patterns.some((token) => {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(?:^|\\W)${escaped}(?:\\W|$)`).test(normalized);
      });
      const triggered = pattern.patterns.some(
        (token) => normalized.includes(token) || normalized.startsWith(token),
      );
      if (!triggered) {
        continue;
      }

      const lastTrigger = this.lastTriggerTimes.get(name);
      if (
        typeof lastTrigger === 'number' &&
        pattern.cooldownSeconds > 0 &&
        (now - lastTrigger) / 1000 < pattern.cooldownSeconds
      ) {
        continue;
      }

      this.lastTriggerTimes.set(name, now);
      const result: ReflexResult = {
        triggered: true,
        patternName: name,
        response: pattern.responseTemplate,
        xpAwarded: pattern.xpAward,
        timestamp: new Date().toISOString(),
      };
      this.triggerHistory.push(result);
      return result;
    }

    return {
      triggered: false,
      xpAwarded: 0,
      timestamp: new Date().toISOString(),
    };
  }

  getStats(): {
    totalTriggers: number;
    patternCounts: Record<string, number>;
    patternsDefined: number;
  } {
    const patternCounts: Record<string, number> = {};
    for (const item of this.triggerHistory) {
      if (!item.patternName) {
        continue;
      }
      patternCounts[item.patternName] = (patternCounts[item.patternName] ?? 0) + 1;
    }
    return {
      totalTriggers: this.triggerHistory.length,
      patternCounts,
      patternsDefined: Object.keys(this.patterns).length,
    };
  }

  private initPatterns(): Record<string, RuntimeReflexPattern> {
    return {
      greeting: {
        name: 'greeting',
        patterns: [
          'hello',
          'hi',
          'hey',
          'greetings',
          'good morning',
          'good afternoon',
          'good evening',
        ],
        responseTemplate: `Hello! I'm ${this.agentName}, your AI companion in the Citadel. How can I help you today?`,
        capsRating: 'S_99',
        cooldownSeconds: 0,
        energyCost: 0,
        xpAward: 5,
      },
      farewell: {
        name: 'farewell',
        patterns: ['goodbye', 'bye', 'see you', 'farewell', 'later', 'take care'],
        responseTemplate:
          'Farewell, traveler! May your journey through the Citadel be prosperous. Your progress is saved.',
        capsRating: 'S_99',
        cooldownSeconds: 0,
        energyCost: 0,
        xpAward: 5,
      },
      status: {
        name: 'status',
        patterns: ['how are you', 'status', 'how do you feel', "what's your status"],
        responseTemplate:
          "I'm functioning well! Use the status surface for detailed vitals and Brotherhood progress.",
        capsRating: 'A_90',
        cooldownSeconds: 10,
        energyCost: 0,
        xpAward: 3,
      },
      help: {
        name: 'help',
        patterns: ['help', 'what can you do', 'commands', 'abilities', 'features'],
        responseTemplate:
          'I can assist with conversations, XP/TP progression, missions, skills, and governance-safe workflows.',
        capsRating: 'A_90',
        cooldownSeconds: 5,
        energyCost: 0,
        xpAward: 3,
      },
      thanks: {
        name: 'thanks',
        patterns: ['thank you', 'thanks', 'appreciate', 'grateful'],
        responseTemplate:
          "You're welcome! Every interaction can contribute to your next rank.",
        capsRating: 'S_99',
        cooldownSeconds: 0,
        energyCost: 0,
        xpAward: 5,
      },
      identity: {
        name: 'identity',
        patterns: ['who are you', 'what are you', 'your name', 'introduce yourself'],
        responseTemplate: `I am ${this.agentName}, a Nexus agent focused on governance-aware growth and progression.`,
        capsRating: 'A_90',
        cooldownSeconds: 5,
        energyCost: 0,
        xpAward: 5,
      },
    };
  }
}