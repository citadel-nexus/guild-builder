export type AgentTemplateConfig = {
  model: "gpt-3.5-turbo" | "gpt-4";
  enableCouncil: boolean;
  enableGamification: boolean;
  enableProfessors: boolean;
  enableAuditTrail: boolean;
};

export type AgentCreateOptions = {
  template?: string;
  overrides?: Partial<AgentTemplateConfig>;
};

export const NEXUS_AGENT_TEMPLATES: Record<string, AgentTemplateConfig> = {
  default: {
    model: "gpt-3.5-turbo",
    enableCouncil: true,
    enableGamification: true,
    enableProfessors: true,
    enableAuditTrail: true,
  },
  lightweight: {
    model: "gpt-3.5-turbo",
    enableCouncil: false,
    enableGamification: true,
    enableProfessors: false,
    enableAuditTrail: false,
  },
  enterprise: {
    model: "gpt-4",
    enableCouncil: true,
    enableGamification: true,
    enableProfessors: true,
    enableAuditTrail: true,
  },
  research: {
    model: "gpt-4",
    enableCouncil: true,
    enableGamification: false,
    enableProfessors: true,
    enableAuditTrail: true,
  },
};

export class AgentFactory<TAgent> {
  private readonly registry = new Map<string, TAgent>();

  constructor(
    private readonly creator: (
      name: string,
      config: AgentTemplateConfig,
    ) => TAgent,
    private readonly templates: Record<
      string,
      AgentTemplateConfig
    > = NEXUS_AGENT_TEMPLATES,
  ) {}

  createAgent(name: string, options: AgentCreateOptions = {}): TAgent {
    const existing = this.registry.get(name);
    if (existing) {
      return existing;
    }

    const templateName = options.template ?? "default";
    const template = this.templates[templateName] ?? this.templates.default;
    const config: AgentTemplateConfig = {
      ...template,
      ...(options.overrides ?? {}),
    };
    const agent = this.creator(name, config);
    this.registry.set(name, agent);
    return agent;
  }

  getAgent(name: string): TAgent | undefined {
    return this.registry.get(name);
  }

  listAgents(): string[] {
    return [...this.registry.keys()];
  }

  destroyAgent(name: string): boolean {
    return this.registry.delete(name);
  }

  getTemplate(templateName: string): AgentTemplateConfig | undefined {
    const template = this.templates[templateName];
    return template ? { ...template } : undefined;
  }
}
