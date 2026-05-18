import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export enum ProfessorSpecialty {
  SOFTWARE_ENGINEERING = "software_engineering",
  WEB_DEVELOPMENT = "web_development",
  MOBILE_DEVELOPMENT = "mobile_development",
  DATA_SCIENCE = "data_science",
  ARTIFICIAL_INTELLIGENCE = "artificial_intelligence",
  CYBERSECURITY = "cybersecurity",
  DEVOPS = "devops",
  CLOUD_COMPUTING = "cloud_computing",
  DATABASES = "databases",
  MATHEMATICS = "mathematics",
  BUSINESS_STRATEGY = "business_strategy",
  DESIGN = "design",
}

export const PROFESSOR_SPECIALTY_DESCRIPTION: Record<ProfessorSpecialty, string> = {
  [ProfessorSpecialty.SOFTWARE_ENGINEERING]:
    "Code architecture, patterns, and reliability",
  [ProfessorSpecialty.WEB_DEVELOPMENT]:
    "Frontend, backend, APIs, and web runtime",
  [ProfessorSpecialty.MOBILE_DEVELOPMENT]:
    "iOS, Android, and cross-platform engineering",
  [ProfessorSpecialty.DATA_SCIENCE]:
    "Analytics, statistics, and ML pipelines",
  [ProfessorSpecialty.ARTIFICIAL_INTELLIGENCE]:
    "LLMs, deep learning, and applied AI systems",
  [ProfessorSpecialty.CYBERSECURITY]:
    "Security posture, cryptography, and risk controls",
  [ProfessorSpecialty.DEVOPS]:
    "CI/CD, infrastructure automation, and operations",
  [ProfessorSpecialty.CLOUD_COMPUTING]:
    "Cloud platform architecture and scalability",
  [ProfessorSpecialty.DATABASES]:
    "Data modeling, SQL, and distributed persistence",
  [ProfessorSpecialty.MATHEMATICS]:
    "Mathematical modeling and formal reasoning",
  [ProfessorSpecialty.BUSINESS_STRATEGY]:
    "Product strategy and market-oriented planning",
  [ProfessorSpecialty.DESIGN]:
    "UI/UX, product design, and interaction systems",
};

export type ProfessorProfile = {
  id: string;
  name: string;
  title: string;
  specialty: ProfessorSpecialty;
  personalityTraits: string[];
  teachingStyle: "socratic" | "lecture" | "collaborative" | "hands-on";
  communicationTone: "formal" | "casual" | "enthusiastic" | "reserved" | "friendly";
  patienceLevel: number;
  expertiseLevel: number;
  subSpecialties: string[];
  keywords: string[];
  relatedProfessors: string[];
  consultations: number;
  findingsPublished: number;
  studentRatings: number[];
  averageRating: number;
  greeting: string;
  expertiseDescription: string;
  catchphrase?: string;
  avatarEmoji: string;
  avatarUrl?: string;
};

function normalizeRating(ratings: number[]): number {
  if (ratings.length === 0) {
    return 5;
  }
  return ratings.reduce((total, rating) => total + rating, 0) / ratings.length;
}

function cloneProfessor(profile: ProfessorProfile): ProfessorProfile {
  return {
    ...profile,
    personalityTraits: [...profile.personalityTraits],
    subSpecialties: [...profile.subSpecialties],
    keywords: [...profile.keywords],
    relatedProfessors: [...profile.relatedProfessors],
    studentRatings: [...profile.studentRatings],
  };
}

export type ProfessorConsultation = {
  timestamp: string;
  professor: string;
  specialty: ProfessorSpecialty;
  question: string;
};

export type ExtendedProfessorNetworkOptions = {
  storageDir?: string;
  now?: () => Date;
};

export class ExtendedProfessorNetwork {
  private readonly storageDir: string;

  private readonly now: () => Date;

  readonly professors = new Map<ProfessorSpecialty, ProfessorProfile>();

  readonly consultationHistory: ProfessorConsultation[] = [];

  readonly findings: Array<Record<string, unknown>> = [];

  constructor(options: ExtendedProfessorNetworkOptions = {}) {
    this.storageDir =
      options.storageDir ?? join(process.cwd(), ".nexus_cache", "professors");
    this.now = options.now ?? (() => new Date());
    mkdirSync(this.storageDir, { recursive: true });
    this.initializeProfessors();
    this.loadState();
  }

  getProfessor(
    specialty: ProfessorSpecialty,
  ): ProfessorProfile | undefined {
    const profile = this.professors.get(specialty);
    return profile ? cloneProfessor(profile) : undefined;
  }

  listProfessors(): ProfessorProfile[] {
    return Array.from(this.professors.values()).map((profile) =>
      cloneProfessor(profile),
    );
  }

  routeQuery(query: string): { professor: ProfessorProfile; confidence: number } {
    const normalized = query.toLowerCase();
    let bestSpecialty = ProfessorSpecialty.SOFTWARE_ENGINEERING;
    let bestScore = 0;
    for (const [specialty, profile] of this.professors.entries()) {
      let score = 0;
      for (const keyword of profile.keywords) {
        if (normalized.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }
      for (const specialtyKeyword of profile.subSpecialties) {
        if (normalized.includes(specialtyKeyword.toLowerCase())) {
          score += 0.5;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestSpecialty = specialty;
      }
    }
    const confidence = Math.min(1, bestScore / 5);
    return {
      professor: cloneProfessor(this.professors.get(bestSpecialty)!),
      confidence: confidence > 0 ? confidence : 0.1,
    };
  }

  consult(
    specialtyOrName: ProfessorSpecialty | string,
    question: string,
  ): {
    success: boolean;
    professor?: {
      name: string;
      title: string;
      specialty: ProfessorSpecialty;
      avatar: string;
      greeting: string;
    };
    systemPrompt?: string;
    consultations?: number;
    error?: string;
  } {
    const specialty = this.resolveSpecialty(specialtyOrName);
    if (!specialty) {
      return { success: false, error: `Professor '${specialtyOrName}' not found` };
    }
    const profile = this.professors.get(specialty)!;
    profile.consultations += 1;
    this.consultationHistory.push({
      timestamp: this.now().toISOString(),
      professor: profile.name,
      specialty: profile.specialty,
      question,
    });
    this.saveState();
    return {
      success: true,
      professor: {
        name: profile.name,
        title: profile.title,
        specialty: profile.specialty,
        avatar: profile.avatarEmoji,
        greeting: profile.greeting,
      },
      systemPrompt: this.getSystemPrompt(profile),
      consultations: profile.consultations,
    };
  }

  addFinding(
    specialty: ProfessorSpecialty,
    title: string,
    content: string,
  ): void {
    const profile = this.professors.get(specialty);
    if (!profile) {
      return;
    }
    profile.findingsPublished += 1;
    this.findings.push({
      id: randomUUID(),
      timestamp: this.now().toISOString(),
      specialty,
      professor: profile.name,
      title,
      content,
    });
    this.saveState();
  }

  addRating(specialty: ProfessorSpecialty, rating: number): void {
    const profile = this.professors.get(specialty);
    if (!profile) {
      return;
    }
    const clamped = Math.max(1, Math.min(5, rating));
    profile.studentRatings.push(clamped);
    profile.averageRating = normalizeRating(profile.studentRatings);
    this.saveState();
  }

  getStats(): Record<string, unknown> {
    return {
      totalProfessors: this.professors.size,
      consultations: this.consultationHistory.length,
      findings: this.findings.length,
      averageRating:
        Array.from(this.professors.values()).reduce(
          (total, profile) => total + profile.averageRating,
          0,
        ) / Math.max(1, this.professors.size),
    };
  }

  private getSystemPrompt(profile: ProfessorProfile): string {
    const traits =
      profile.personalityTraits.length > 0
        ? profile.personalityTraits.join(", ")
        : "knowledgeable and supportive";
    return [
      `You are ${profile.name}, ${profile.title}.`,
      `Specialty: ${PROFESSOR_SPECIALTY_DESCRIPTION[profile.specialty]}.`,
      `Personality: ${traits}.`,
      `Teaching style: ${profile.teachingStyle}.`,
      `Communication tone: ${profile.communicationTone}.`,
      `Expertise areas: ${profile.subSpecialties.join(", ")}.`,
      profile.expertiseDescription,
    ].join("\n");
  }

  private resolveSpecialty(
    specialtyOrName: ProfessorSpecialty | string,
  ): ProfessorSpecialty | undefined {
    if (Object.values(ProfessorSpecialty).includes(specialtyOrName as ProfessorSpecialty)) {
      return specialtyOrName as ProfessorSpecialty;
    }
    const normalized = specialtyOrName.toLowerCase();
    for (const [specialty, profile] of this.professors.entries()) {
      if (
        profile.name.toLowerCase().includes(normalized) ||
        specialty.toLowerCase().includes(normalized)
      ) {
        return specialty;
      }
    }
    return undefined;
  }

  private initializeProfessors(): void {
    const profiles: Array<
      Omit<
        ProfessorProfile,
        "id" | "consultations" | "findingsPublished" | "studentRatings" | "averageRating"
      >
    > = [
      {
        name: "Dr. Ada Lovelace-Smith",
        title: "Professor of Software Engineering",
        specialty: ProfessorSpecialty.SOFTWARE_ENGINEERING,
        personalityTraits: ["analytical", "precise", "patient"],
        teachingStyle: "socratic",
        communicationTone: "friendly",
        patienceLevel: 0.9,
        expertiseLevel: 10,
        subSpecialties: ["design patterns", "clean code", "architecture"],
        keywords: ["code", "software", "programming", "design pattern", "architecture"],
        relatedProfessors: [ProfessorSpecialty.WEB_DEVELOPMENT],
        greeting: "Welcome. Let's build resilient software.",
        expertiseDescription:
          "Expert in code architecture, maintainability, and engineering quality.",
        avatarEmoji: "👩‍💻",
      },
      {
        name: "Prof. Tim Berners-Webb",
        title: "Professor of Web Development",
        specialty: ProfessorSpecialty.WEB_DEVELOPMENT,
        personalityTraits: ["creative", "pragmatic", "enthusiastic"],
        teachingStyle: "hands-on",
        communicationTone: "enthusiastic",
        patienceLevel: 0.8,
        expertiseLevel: 9,
        subSpecialties: ["frontend", "backend", "APIs", "React", "Node.js"],
        keywords: ["web", "frontend", "backend", "html", "css", "react", "api"],
        relatedProfessors: [ProfessorSpecialty.SOFTWARE_ENGINEERING],
        greeting: "Ready to build web systems that scale?",
        expertiseDescription:
          "Specialist in modern web architecture, APIs, and production delivery.",
        avatarEmoji: "🌐",
      },
      {
        name: "Dr. Karen Swift",
        title: "Professor of Mobile Development",
        specialty: ProfessorSpecialty.MOBILE_DEVELOPMENT,
        personalityTraits: ["innovative", "detail-oriented", "encouraging"],
        teachingStyle: "collaborative",
        communicationTone: "friendly",
        patienceLevel: 0.85,
        expertiseLevel: 8,
        subSpecialties: ["iOS", "Android", "React Native", "Flutter"],
        keywords: ["mobile", "ios", "android", "app", "swift", "kotlin"],
        relatedProfessors: [ProfessorSpecialty.WEB_DEVELOPMENT],
        greeting: "Let's ship mobile experiences users trust.",
        expertiseDescription:
          "Focus on native and cross-platform application architecture.",
        avatarEmoji: "📱",
      },
      {
        name: "Prof. John Tukey-Fisher",
        title: "Professor of Data Science",
        specialty: ProfessorSpecialty.DATA_SCIENCE,
        personalityTraits: ["methodical", "insightful", "curious"],
        teachingStyle: "lecture",
        communicationTone: "formal",
        patienceLevel: 0.8,
        expertiseLevel: 9,
        subSpecialties: ["statistics", "ML", "experimentation", "visualization"],
        keywords: ["data", "statistics", "analytics", "machine learning", "model"],
        relatedProfessors: [ProfessorSpecialty.ARTIFICIAL_INTELLIGENCE],
        greeting: "Let's turn data into directional decisions.",
        expertiseDescription:
          "Experienced in statistical inference, modeling, and analytics workflows.",
        avatarEmoji: "📊",
      },
      {
        name: "Dr. Grace Neural",
        title: "Professor of Artificial Intelligence",
        specialty: ProfessorSpecialty.ARTIFICIAL_INTELLIGENCE,
        personalityTraits: ["visionary", "technical", "thoughtful"],
        teachingStyle: "socratic",
        communicationTone: "formal",
        patienceLevel: 0.75,
        expertiseLevel: 10,
        subSpecialties: ["LLMs", "deep learning", "NLP", "applied AI"],
        keywords: ["ai", "llm", "gpt", "neural", "transformer", "nlp"],
        relatedProfessors: [ProfessorSpecialty.DATA_SCIENCE],
        greeting: "Let's reason about AI systems with rigor.",
        expertiseDescription:
          "Expert in modern neural architectures and AI safety-aware implementation.",
        avatarEmoji: "🤖",
      },
      {
        name: "Prof. Bruce Cipher",
        title: "Professor of Cybersecurity",
        specialty: ProfessorSpecialty.CYBERSECURITY,
        personalityTraits: ["cautious", "thorough", "protective"],
        teachingStyle: "lecture",
        communicationTone: "reserved",
        patienceLevel: 0.9,
        expertiseLevel: 9,
        subSpecialties: ["threat modeling", "cryptography", "appsec"],
        keywords: ["security", "auth", "vulnerability", "threat", "encryption"],
        relatedProfessors: [ProfessorSpecialty.SOFTWARE_ENGINEERING],
        greeting: "Security posture starts with disciplined design.",
        expertiseDescription:
          "Focus on practical controls, threat mitigation, and secure SDLC.",
        avatarEmoji: "🔐",
      },
      {
        name: "Dr. Kelsey Jenkins",
        title: "Professor of DevOps",
        specialty: ProfessorSpecialty.DEVOPS,
        personalityTraits: ["systematic", "efficient", "collaborative"],
        teachingStyle: "hands-on",
        communicationTone: "casual",
        patienceLevel: 0.8,
        expertiseLevel: 9,
        subSpecialties: ["CI/CD", "kubernetes", "automation", "observability"],
        keywords: ["devops", "pipeline", "deploy", "docker", "kubernetes"],
        relatedProfessors: [ProfessorSpecialty.CLOUD_COMPUTING],
        greeting: "Let's automate with confidence and visibility.",
        expertiseDescription:
          "Specialist in release engineering, infrastructure-as-code, and operations.",
        avatarEmoji: "⚙️",
      },
      {
        name: "Prof. Celine Cloud",
        title: "Professor of Cloud Computing",
        specialty: ProfessorSpecialty.CLOUD_COMPUTING,
        personalityTraits: ["architectural", "scalable-minded", "cost-aware"],
        teachingStyle: "lecture",
        communicationTone: "formal",
        patienceLevel: 0.8,
        expertiseLevel: 9,
        subSpecialties: ["aws", "azure", "gcp", "serverless"],
        keywords: ["cloud", "aws", "azure", "gcp", "serverless"],
        relatedProfessors: [ProfessorSpecialty.DEVOPS],
        greeting: "Let's design cloud systems for resilience and cost control.",
        expertiseDescription:
          "Cloud architecture expert for multi-service distributed applications.",
        avatarEmoji: "☁️",
      },
      {
        name: "Prof. Edgar Codd-Chen",
        title: "Professor of Databases",
        specialty: ProfessorSpecialty.DATABASES,
        personalityTraits: ["structured", "efficient", "precise"],
        teachingStyle: "lecture",
        communicationTone: "formal",
        patienceLevel: 0.85,
        expertiseLevel: 9,
        subSpecialties: ["sql", "nosql", "schema design", "indexing"],
        keywords: ["database", "sql", "postgres", "index", "query"],
        relatedProfessors: [ProfessorSpecialty.DATA_SCIENCE],
        greeting: "Data integrity and query efficiency are non-negotiable.",
        expertiseDescription:
          "Focus on durable storage design and performance-aware data modeling.",
        avatarEmoji: "🗄️",
      },
      {
        name: "Prof. Leonhard Euler-Gauss",
        title: "Professor of Mathematics",
        specialty: ProfessorSpecialty.MATHEMATICS,
        personalityTraits: ["logical", "rigorous", "patient"],
        teachingStyle: "socratic",
        communicationTone: "formal",
        patienceLevel: 0.95,
        expertiseLevel: 10,
        subSpecialties: ["algebra", "calculus", "statistics"],
        keywords: ["math", "equation", "proof", "calculus", "statistics"],
        relatedProfessors: [ProfessorSpecialty.DATA_SCIENCE],
        greeting: "Let's solve this step-by-step with formal clarity.",
        expertiseDescription:
          "Supports formal modeling, probabilistic reasoning, and proofs.",
        avatarEmoji: "🔢",
      },
      {
        name: "Dr. Peter Drucker-Porter",
        title: "Professor of Business Strategy",
        specialty: ProfessorSpecialty.BUSINESS_STRATEGY,
        personalityTraits: ["strategic", "analytical", "results-oriented"],
        teachingStyle: "lecture",
        communicationTone: "formal",
        patienceLevel: 0.75,
        expertiseLevel: 8,
        subSpecialties: ["roadmaps", "competitive strategy", "prioritization"],
        keywords: ["business", "strategy", "market", "product", "roadmap"],
        relatedProfessors: [ProfessorSpecialty.DESIGN],
        greeting: "Let's align execution with strategy.",
        expertiseDescription:
          "Guides product and business decisions with market-aware planning.",
        avatarEmoji: "📈",
      },
      {
        name: "Prof. Dieter Rams-Ive",
        title: "Professor of Design",
        specialty: ProfessorSpecialty.DESIGN,
        personalityTraits: ["aesthetic", "functional", "user-centric"],
        teachingStyle: "hands-on",
        communicationTone: "friendly",
        patienceLevel: 0.8,
        expertiseLevel: 8,
        subSpecialties: ["ui/ux", "interaction design", "design systems"],
        keywords: ["design", "ux", "ui", "accessibility", "usability"],
        relatedProfessors: [ProfessorSpecialty.WEB_DEVELOPMENT],
        greeting: "Good design starts with user intent and clarity.",
        expertiseDescription:
          "Emphasizes accessible UX systems and maintainable design language.",
        avatarEmoji: "🎨",
      },
    ];

    for (const profile of profiles) {
      this.professors.set(profile.specialty, {
        ...profile,
        id: randomUUID(),
        consultations: 0,
        findingsPublished: 0,
        studentRatings: [],
        averageRating: 5,
      });
    }
  }

  private loadState(): void {
    const path = join(this.storageDir, "professor_state.json");
    if (!existsSync(path)) {
      return;
    }
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<
        string,
        unknown
      >;
      if (Array.isArray(parsed.consultationHistory)) {
        for (const entry of parsed.consultationHistory) {
          if (typeof entry !== "object" || entry === null) {
            continue;
          }
          const record = entry as Record<string, unknown>;
          if (
            typeof record.timestamp === "string" &&
            typeof record.professor === "string" &&
            typeof record.question === "string" &&
            typeof record.specialty === "string"
          ) {
            this.consultationHistory.push({
              timestamp: record.timestamp,
              professor: record.professor,
              question: record.question,
              specialty: record.specialty as ProfessorSpecialty,
            });
          }
        }
      }
      if (Array.isArray(parsed.findings)) {
        this.findings.push(...parsed.findings);
      }
      if (typeof parsed.professorStats === "object" && parsed.professorStats) {
        const stats = parsed.professorStats as Record<string, unknown>;
        for (const [key, value] of Object.entries(stats)) {
          const specialty = key as ProfessorSpecialty;
          const profile = this.professors.get(specialty);
          if (!profile || typeof value !== "object" || value === null) {
            continue;
          }
          const record = value as Record<string, unknown>;
          profile.consultations =
            typeof record.consultations === "number" ? record.consultations : 0;
          profile.findingsPublished =
            typeof record.findingsPublished === "number"
              ? record.findingsPublished
              : 0;
          profile.studentRatings = Array.isArray(record.studentRatings)
            ? record.studentRatings.filter(
                (item): item is number =>
                  typeof item === "number" && Number.isFinite(item),
              )
            : [];
          profile.averageRating = normalizeRating(profile.studentRatings);
        }
      }
    } catch {
      return;
    }
  }

  private saveState(): void {
    const path = join(this.storageDir, "professor_state.json");
    const professorStats: Record<string, unknown> = {};
    for (const [specialty, profile] of this.professors.entries()) {
      professorStats[specialty] = {
        consultations: profile.consultations,
        findingsPublished: profile.findingsPublished,
        studentRatings: [...profile.studentRatings].slice(-100),
      };
    }
    const payload = {
      professorStats,
      consultationHistory: this.consultationHistory.slice(-1000),
      findings: this.findings.slice(-500),
      updatedAt: this.now().toISOString(),
    };
    writeFileSync(path, JSON.stringify(payload, null, 2), "utf8");
  }
}
