import { randomUUID } from 'node:crypto';

export type ProfessorFinding = {
  id: string;
  professor: string;
  title: string;
  content: string;
  confidence: number;
  tags: string[];
  timestamp: string;
  publishedToNotion: boolean;
  notionPageId?: string;
};

export type ProfessorResponse = {
  professor: string;
  question: string;
  answer: string;
  confidence: number;
  finding?: ProfessorFinding;
  processingTimeMs: number;
};

type NotionKnowledgeSync = {
  publishFinding: (
    professorDomain: string,
    title: string,
    content: string,
  ) => string | undefined;
};

type ProfessorDomainInfo = {
  name: string;
  expertise: string[];
  keywords: string[];
};

type ProfessorState = ProfessorDomainInfo & {
  active: boolean;
  findingsCount: number;
  queriesHandled: number;
};

export class ProfessorNetwork {
  static readonly PROFESSOR_DOMAINS: Record<string, ProfessorDomainInfo> = {
    systems_engineering: {
      name: 'Systems Engineering',
      expertise: ['architecture', 'design', 'integration', 'scalability'],
      keywords: ['system', 'architecture', 'design', 'scale', 'infrastructure'],
    },
    product_management: {
      name: 'Product Management',
      expertise: ['roadmap', 'requirements', 'features', 'user stories'],
      keywords: ['product', 'feature', 'roadmap', 'requirement', 'user story'],
    },
    legal_compliance: {
      name: 'Legal Compliance',
      expertise: ['contracts', 'regulations', 'privacy', 'gdpr'],
      keywords: ['legal', 'compliance', 'contract', 'regulation', 'privacy', 'gdpr'],
    },
    security_privacy: {
      name: 'Security and Privacy',
      expertise: ['encryption', 'authentication', 'authorization', 'auditing'],
      keywords: ['security', 'privacy', 'encryption', 'auth', 'vulnerability'],
    },
    financial_ops: {
      name: 'Financial Operations',
      expertise: ['budgeting', 'forecasting', 'billing', 'revenue'],
      keywords: ['finance', 'budget', 'revenue', 'billing', 'cost', 'pricing'],
    },
    human_resources: {
      name: 'Human Resources',
      expertise: ['hiring', 'onboarding', 'culture', 'performance'],
      keywords: ['hr', 'hiring', 'onboarding', 'culture', 'team', 'employee'],
    },
    operations_infra: {
      name: 'Operations and Infrastructure',
      expertise: ['deployment', 'monitoring', 'scaling', 'reliability'],
      keywords: ['ops', 'infrastructure', 'deploy', 'monitor', 'server', 'cloud'],
    },
    data_science_ml: {
      name: 'Data Science and ML',
      expertise: ['models', 'training', 'inference', 'analytics'],
      keywords: ['data', 'ml', 'ai', 'model', 'training', 'analytics', 'prediction'],
    },
    devops_deploy: {
      name: 'DevOps and Deployment',
      expertise: ['ci/cd', 'containers', 'kubernetes', 'automation'],
      keywords: ['devops', 'ci', 'cd', 'docker', 'kubernetes', 'pipeline', 'automation'],
    },
    ux_design: {
      name: 'User Experience Design',
      expertise: ['usability', 'accessibility', 'design systems', 'prototyping'],
      keywords: ['ux', 'ui', 'design', 'usability', 'accessibility', 'user'],
    },
    marketing: {
      name: 'Marketing',
      expertise: ['campaigns', 'branding', 'content', 'seo'],
      keywords: ['marketing', 'campaign', 'brand', 'content', 'seo', 'social'],
    },
    sales_growth: {
      name: 'Sales and Growth',
      expertise: ['pipeline', 'conversion', 'deals', 'expansion'],
      keywords: ['sales', 'growth', 'deal', 'pipeline', 'conversion', 'revenue'],
    },
    customer_success: {
      name: 'Customer Success',
      expertise: ['onboarding', 'support', 'retention', 'satisfaction'],
      keywords: ['customer', 'support', 'success', 'retention', 'churn', 'nps'],
    },
    technical_training: {
      name: 'Technical Training',
      expertise: ['documentation', 'tutorials', 'workshops', 'certifications'],
      keywords: ['training', 'tutorial', 'documentation', 'workshop', 'learn'],
    },
    regulatory_compliance: {
      name: 'Regulatory Compliance',
      expertise: ['soc2', 'hipaa', 'pci', 'audits'],
      keywords: ['compliance', 'audit', 'soc2', 'hipaa', 'pci', 'regulation'],
    },
    solution_architecture: {
      name: 'Solution Architecture',
      expertise: ['patterns', 'integration', 'apis', 'services'],
      keywords: ['solution', 'architecture', 'pattern', 'api', 'integration'],
    },
    infrastructure: {
      name: 'Infrastructure',
      expertise: ['servers', 'networking', 'storage', 'compute'],
      keywords: ['infra', 'server', 'network', 'storage', 'compute', 'vm'],
    },
    reliability_engineering: {
      name: 'Reliability Engineering',
      expertise: ['slos', 'incidents', 'postmortems', 'chaos engineering'],
      keywords: ['sre', 'reliability', 'slo', 'incident', 'postmortem', 'uptime'],
    },
    performance_optimization: {
      name: 'Performance Optimization',
      expertise: ['profiling', 'caching', 'indexing', 'benchmarking'],
      keywords: ['performance', 'optimize', 'cache', 'index', 'benchmark', 'latency'],
    },
    testing: {
      name: 'Testing',
      expertise: ['unit tests', 'integration tests', 'e2e', 'qa'],
      keywords: ['test', 'qa', 'unit', 'integration', 'e2e', 'coverage'],
    },
    documentation: {
      name: 'Documentation',
      expertise: ['technical writing', 'api docs', 'guides', 'references'],
      keywords: ['docs', 'documentation', 'guide', 'reference', 'readme', 'wiki'],
    },
    community_building: {
      name: 'Community Building',
      expertise: ['forums', 'events', 'engagement', 'advocacy'],
      keywords: ['community', 'forum', 'event', 'engagement', 'advocate'],
    },
    growth_strategy: {
      name: 'Growth Strategy',
      expertise: ['acquisition', 'activation', 'retention', 'referral'],
      keywords: ['growth', 'strategy', 'acquisition', 'activation', 'retention'],
    },
    fundraising_partnerships: {
      name: 'Fundraising and Partnerships',
      expertise: ['investors', 'grants', 'partnerships', 'deals'],
      keywords: ['funding', 'investor', 'partnership', 'grant', 'deal'],
    },
    talent_recruitment: {
      name: 'Talent Recruitment',
      expertise: ['sourcing', 'interviewing', 'offers', 'diversity'],
      keywords: ['recruit', 'hire', 'talent', 'interview', 'candidate'],
    },
    strategic_planning: {
      name: 'Strategic Planning',
      expertise: ['vision', 'goals', 'okrs', 'roadmaps'],
      keywords: ['strategy', 'plan', 'vision', 'goal', 'okr', 'roadmap'],
    },
    partnership_development: {
      name: 'Partnership Development',
      expertise: ['integrations', 'alliances', 'co-marketing', 'channels'],
      keywords: ['partner', 'alliance', 'integration', 'channel', 'co-marketing'],
    },
    administrative_coordination: {
      name: 'Administrative Coordination',
      expertise: ['scheduling', 'logistics', 'processes', 'workflows'],
      keywords: ['admin', 'schedule', 'logistics', 'process', 'workflow'],
    },
  };

  readonly professors: Record<string, ProfessorState>;
  readonly knowledgeGraph: Record<string, ProfessorFinding> = {};
  readonly findings: ProfessorFinding[] = [];
  readonly queryHistory: ProfessorResponse[] = [];
  vectorCount = 0;

  constructor(private readonly notionSync?: NotionKnowledgeSync) {
    this.professors = this.initProfessors();
  }

  routeToProfessor(question: string): string | undefined {
    const query = question.toLowerCase();
    let bestMatch: string | undefined;
    let bestScore = 0;

    for (const [domainId, state] of Object.entries(this.professors)) {
      if (!state.active) {
        continue;
      }
      let score = 0;
      for (const keyword of state.keywords) {
        if (query.includes(keyword)) {
          score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = domainId;
      }
    }

    return bestMatch;
  }

  askProfessor(question: string, domainId?: string): ProfessorResponse {
    const started = Date.now();
    let resolvedDomainId = domainId;
    if (!resolvedDomainId) {
      resolvedDomainId = this.routeToProfessor(question);
    }

    if (!resolvedDomainId || !this.professors[resolvedDomainId]) {
      return {
        professor: 'Unknown',
        question,
        answer: 'No suitable expert found for this question.',
        confidence: 0,
        processingTimeMs: Date.now() - started,
      };
    }

    const state = this.professors[resolvedDomainId];
    state.queriesHandled += 1;

    const expertise = state.expertise.slice(0, 3).join(', ');
    const answer = `As a ${state.name} expert, I can help with ${expertise}. ${question}`;

    const query = question.toLowerCase();
    let matches = 0;
    for (const keyword of state.keywords) {
      if (query.includes(keyword)) {
        matches += 1;
      }
    }
    const confidence = Math.min(0.9, 0.5 + matches * 0.1);

    const response: ProfessorResponse = {
      professor: state.name,
      question,
      answer,
      confidence,
      processingTimeMs: Date.now() - started,
    };
    this.queryHistory.push(response);
    return response;
  }

  publishFinding(
    professorDomain: string,
    findingTitle: string,
    findingContent: string,
    tags: string[] = [],
  ): ProfessorFinding {
    const finding: ProfessorFinding = {
      id: randomUUID(),
      professor: professorDomain,
      title: findingTitle,
      content: findingContent,
      confidence: 0.8,
      tags: [...tags],
      timestamp: new Date().toISOString(),
      publishedToNotion: false,
    };

    this.knowledgeGraph[finding.id] = finding;
    this.findings.push(finding);
    this.vectorCount += 1;

    const state = this.professors[professorDomain];
    if (state) {
      state.findingsCount += 1;
    }

    if (this.notionSync) {
      const pageId = this.notionSync.publishFinding(
        professorDomain,
        findingTitle,
        findingContent,
      );
      if (pageId) {
        finding.publishedToNotion = true;
        finding.notionPageId = pageId;
      }
    }

    return finding;
  }

  getFindingsByProfessor(professorDomain: string): ProfessorFinding[] {
    return this.findings.filter((finding) => finding.professor === professorDomain);
  }

  searchKnowledgeGraph(query: string, limit: number = 10): ProfessorFinding[] {
    const q = query.toLowerCase();
    const results: ProfessorFinding[] = [];
    for (const finding of this.findings) {
      if (
        finding.title.toLowerCase().includes(q) ||
        finding.content.toLowerCase().includes(q)
      ) {
        results.push(finding);
      }
      if (results.length >= limit) {
        break;
      }
    }
    return results;
  }

  getProfessorStats(): Record<string, Record<string, string | number | boolean>> {
    const output: Record<string, Record<string, string | number | boolean>> = {};
    for (const [domainId, state] of Object.entries(this.professors)) {
      output[domainId] = {
        name: state.name,
        findings: state.findingsCount,
        queries: state.queriesHandled,
        active: state.active,
      };
    }
    return output;
  }

  getTopProfessors(limit: number = 5): Array<[string, number]> {
    const entries = Object.entries(this.professors);
    entries.sort((left, right) => right[1].findingsCount - left[1].findingsCount);
    return entries.slice(0, limit).map(([_, state]) => [state.name, state.findingsCount]);
  }

  private initProfessors(): Record<string, ProfessorState> {
    const output: Record<string, ProfessorState> = {};
    for (const [domainId, domain] of Object.entries(ProfessorNetwork.PROFESSOR_DOMAINS)) {
      output[domainId] = {
        name: domain.name,
        expertise: [...domain.expertise],
        keywords: [...domain.keywords],
        active: true,
        findingsCount: 0,
        queriesHandled: 0,
      };
    }
    return output;
  }
}