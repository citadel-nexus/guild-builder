import { randomUUID } from "node:crypto";

export enum ResponseFormat {
  PLAIN_TEXT = "plain_text",
  MARKDOWN = "markdown",
  HTML = "html",
  JSON = "json",
  RICH_TEXT = "rich_text",
  CODE = "code",
  TABLE = "table",
}

export enum ResponseTone {
  FORMAL = "formal",
  CASUAL = "casual",
  TECHNICAL = "technical",
  FRIENDLY = "friendly",
  CONCISE = "concise",
  DETAILED = "detailed",
  PLAYFUL = "playful",
  NEUTRAL = "neutral",
}

export enum ResponsePriority {
  CRITICAL = "critical",
  HIGH = "high",
  NORMAL = "normal",
  LOW = "low",
  BACKGROUND = "background",
}

export const RESPONSE_PRIORITY_LEVEL: Record<ResponsePriority, number> = {
  [ResponsePriority.CRITICAL]: 0,
  [ResponsePriority.HIGH]: 1,
  [ResponsePriority.NORMAL]: 2,
  [ResponsePriority.LOW]: 3,
  [ResponsePriority.BACKGROUND]: 4,
};

export type ResponseSection = {
  title?: string;
  content: string;
  format: ResponseFormat;
  priority: ResponsePriority;
  collapsible: boolean;
  defaultCollapsed: boolean;
  metadata: Record<string, unknown>;
};

export function createResponseSection(input: Partial<ResponseSection> & {
  content: string;
}): ResponseSection {
  return {
    title: input.title,
    content: input.content,
    format: input.format ?? ResponseFormat.PLAIN_TEXT,
    priority: input.priority ?? ResponsePriority.NORMAL,
    collapsible: input.collapsible ?? false,
    defaultCollapsed: input.defaultCollapsed ?? false,
    metadata: { ...(input.metadata ?? {}) },
  };
}

export type ResponseConfig = {
  format: ResponseFormat;
  tone: ResponseTone;
  maxLength: number;
  includeGreeting: boolean;
  includeSignature: boolean;
  includeTimestamp: boolean;
  codeHighlighting: boolean;
  emojiEnabled: boolean;
  language: string;
  customGreeting?: string;
  customSignature?: string;
};

export const DEFAULT_RESPONSE_CONFIG: ResponseConfig = {
  format: ResponseFormat.MARKDOWN,
  tone: ResponseTone.FRIENDLY,
  maxLength: 2_000,
  includeGreeting: true,
  includeSignature: false,
  includeTimestamp: false,
  codeHighlighting: true,
  emojiEnabled: true,
  language: "en",
};

export class FormattedResponse {
  id: string;
  sections: ResponseSection[];
  greeting?: string;
  mainContent: string;
  signature?: string;
  format: ResponseFormat;
  tone: ResponseTone;
  wordCount: number;
  characterCount: number;
  createdAt: string;
  metadata: Record<string, unknown>;

  constructor(input: {
    id?: string;
    sections?: ResponseSection[];
    greeting?: string;
    mainContent: string;
    signature?: string;
    format: ResponseFormat;
    tone: ResponseTone;
    wordCount?: number;
    characterCount?: number;
    createdAt?: string;
    metadata?: Record<string, unknown>;
  }) {
    this.id = input.id ?? randomUUID();
    this.sections = [...(input.sections ?? [])];
    this.greeting = input.greeting;
    this.mainContent = input.mainContent;
    this.signature = input.signature;
    this.format = input.format;
    this.tone = input.tone;
    this.wordCount = input.wordCount ?? input.mainContent.trim().split(/\s+/g).filter(Boolean).length;
    this.characterCount = input.characterCount ?? input.mainContent.length;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = { ...(input.metadata ?? {}) };
  }

  toString(): string {
    const output: string[] = [];
    if (this.greeting) {
      output.push(this.greeting);
    }
    if (this.sections.length > 0) {
      for (const section of this.sections) {
        if (section.title) {
          output.push(`\n**${section.title}**\n`);
        }
        output.push(section.content);
      }
    } else {
      output.push(this.mainContent);
    }
    if (this.signature) {
      output.push(`\n---\n${this.signature}`);
    }
    return output.join("\n");
  }
}

export class ResponseFormatter {
  static readonly GREETINGS: Record<ResponseTone, string[]> = {
    [ResponseTone.FORMAL]: ["Greetings.", "Hello.", "Good day."],
    [ResponseTone.CASUAL]: ["Hey!", "Hi there!", "What's up!"],
    [ResponseTone.TECHNICAL]: ["Acknowledged.", "Processing request."],
    [ResponseTone.FRIENDLY]: ["Hello!", "Hi!", "Hey there!"],
    [ResponseTone.CONCISE]: ["Hi."],
    [ResponseTone.DETAILED]: ["Hello.", "Let's walk through this in detail."],
    [ResponseTone.PLAYFUL]: ["Howdy!", "Hey friend!"],
    [ResponseTone.NEUTRAL]: ["Hello."],
  };

  static readonly SIGNATURES: Record<ResponseTone, string> = {
    [ResponseTone.FORMAL]: "Best regards,\nNexus Agent",
    [ResponseTone.CASUAL]: "Cheers,\nNexus",
    [ResponseTone.TECHNICAL]: "-- End of response --",
    [ResponseTone.FRIENDLY]: "Happy to help,\nNexus Agent",
    [ResponseTone.CONCISE]: "- Nexus",
    [ResponseTone.DETAILED]: "If you want, I can break this down further.\n- Nexus Agent",
    [ResponseTone.PLAYFUL]: "Stay awesome,\nNexus",
    [ResponseTone.NEUTRAL]: "- Nexus Agent",
  };

  config: ResponseConfig;

  constructor(config: Partial<ResponseConfig> = {}) {
    this.config = { ...DEFAULT_RESPONSE_CONFIG, ...config };
  }

  format(content: string, config: Partial<ResponseConfig> = {}): FormattedResponse {
    const mergedConfig = { ...this.config, ...config };
    const greeting = this.getGreeting(mergedConfig);
    const signature = this.getSignature(mergedConfig);
    let formattedContent = this.applyFormat(content, mergedConfig.format);
    if (formattedContent.length > mergedConfig.maxLength) {
      formattedContent = `${formattedContent.slice(0, mergedConfig.maxLength - 3)}...`;
    }
    const output = new FormattedResponse({
      greeting,
      mainContent: formattedContent,
      signature,
      format: mergedConfig.format,
      tone: mergedConfig.tone,
      metadata: mergedConfig.includeTimestamp
        ? { timestamp: new Date().toISOString() }
        : {},
    });
    return output;
  }

  private getGreeting(config: ResponseConfig): string | undefined {
    if (!config.includeGreeting) {
      return undefined;
    }
    if (config.customGreeting) {
      return config.customGreeting;
    }
    const values = ResponseFormatter.GREETINGS[config.tone] ?? ["Hello."];
    return values[Math.floor(Math.random() * values.length)] ?? values[0];
  }

  private getSignature(config: ResponseConfig): string | undefined {
    if (!config.includeSignature) {
      return undefined;
    }
    if (config.customSignature) {
      return config.customSignature;
    }
    return ResponseFormatter.SIGNATURES[config.tone] ?? "- Nexus Agent";
  }

  applyFormat(content: string, format: ResponseFormat): string {
    if (format === ResponseFormat.PLAIN_TEXT) {
      return this.stripMarkdown(content);
    }
    if (format === ResponseFormat.HTML) {
      return this.markdownToHtml(content);
    }
    if (format === ResponseFormat.JSON) {
      return JSON.stringify({ content }, null, 2);
    }
    return content;
  }

  stripMarkdown(content: string): string {
    let output = content;
    output = output.replace(/^#+\s*/gm, "");
    output = output.replace(/\*\*([^*]+)\*\*/g, "$1");
    output = output.replace(/\*([^*]+)\*/g, "$1");
    output = output.replace(/__([^_]+)__/g, "$1");
    output = output.replace(/_([^_]+)_/g, "$1");
    output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
    return output;
  }

  markdownToHtml(content: string): string {
    let output = content;
    output = output.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    output = output.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    output = output.replace(/^# (.+)$/gm, "<h1>$1</h1>");
    output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
    output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    output = output.replace(/\n{2,}/g, "</p><p>");
    return `<p>${output}</p>`;
  }

  formatCodeBlock(code: string, language = ""): string {
    return `\`\`\`${language}\n${code}\n\`\`\``;
  }

  formatList(items: string[], ordered = false): string {
    if (ordered) {
      return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
    }
    return items.map((item) => `- ${item}`).join("\n");
  }

  formatTable(headers: string[], rows: string[][]): string {
    const headerRow = `| ${headers.join(" | ")} |`;
    const separator = `| ${headers.map((header) => "-".repeat(Math.max(3, header.length))).join(" | ")} |`;
    const dataRows = rows.map((row) => `| ${row.join(" | ")} |`);
    return [headerRow, separator, ...dataRows].join("\n");
  }
}

export type ResponsePreprocessor = (content: string) => string;
export type ResponsePostprocessor = (content: string) => string;
export type ResponseValidator = (content: string) => { isValid: boolean; message: string };

export class ResponsePipeline {
  formatter: ResponseFormatter;
  preprocessors: ResponsePreprocessor[];
  postprocessors: ResponsePostprocessor[];
  validators: ResponseValidator[];

  constructor(formatter?: ResponseFormatter) {
    this.formatter = formatter ?? new ResponseFormatter();
    this.preprocessors = [];
    this.postprocessors = [];
    this.validators = [];
  }

  addPreprocessor(processor: ResponsePreprocessor): void {
    this.preprocessors.push(processor);
  }

  addPostprocessor(processor: ResponsePostprocessor): void {
    this.postprocessors.push(processor);
  }

  addValidator(validator: ResponseValidator): void {
    this.validators.push(validator);
  }

  process(content: string, config: Partial<ResponseConfig> = {}): FormattedResponse {
    let output = content;
    for (const processor of this.preprocessors) {
      output = processor(output);
    }
    const formatted = this.formatter.format(output, config);
    let finalMainContent = formatted.mainContent;
    for (const processor of this.postprocessors) {
      finalMainContent = processor(finalMainContent);
    }
    formatted.mainContent = finalMainContent;
    for (const validator of this.validators) {
      const validation = validator(finalMainContent);
      if (!validation.isValid) {
        formatted.metadata.validationWarning = validation.message;
      }
    }
    return formatted;
  }
}

export class ResponseTemplateEngine {
  private readonly templates = new Map<string, string>();

  constructor() {
    this.loadDefaultTemplates();
  }

  private loadDefaultTemplates(): void {
    this.templates.set("greeting", "Hello! I'm {agentName}. {customMessage}");
    this.templates.set("error", "I encountered an issue: {errorMessage}. Please try again.");
    this.templates.set("success", "Great news! {action} completed successfully.");
    this.templates.set("xp_award", "You earned **{xpAmount} XP** for {reason}! Total: {totalXp} XP");
    this.templates.set("rank_up", "Congratulations! You've reached **{newRank}** rank!");
    this.templates.set("badge_unlock", "Badge unlocked: **{badgeName}** - {badgeDescription}");
    this.templates.set("quest_complete", "Quest complete: **{questName}**");
    this.templates.set("help", "Here's what I can help with:\n{helpItems}");
    this.templates.set("status", "**Status**\nXP: {xp} | TP: {tp} | Rank: {rank}");
    this.templates.set("farewell", "Goodbye! {farewellMessage}");
  }

  registerTemplate(name: string, template: string): void {
    this.templates.set(name, template);
  }

  render(templateName: string, values: Record<string, string | number>): string {
    const template = this.templates.get(templateName);
    if (!template) {
      return `Template '${templateName}' not found.`;
    }
    return template.replace(/\{([^}]+)\}/g, (full, key: string) => {
      const value = values[key];
      return value === undefined ? full : String(value);
    });
  }

  listTemplates(): string[] {
    return [...this.templates.keys()];
  }
}