import { describe, expect, it } from "vitest";

import {
  EntityType,
  IntentCategory,
  LanguageCode,
  NLUEntityExtractor,
  NLUIntentClassifier,
  NLUPipeline,
  NLUSentimentAnalyzer,
  NLUTextPreprocessor,
  NLUTextSimilarity,
  TopicCategory,
} from "../../../src/agents/nexus-tamagotchi/nlu-engine.js";

describe("nlu-engine", () => {
  it("preprocesses text and detects intent/topic", () => {
    const preprocessor = new NLUTextPreprocessor();
    const output = preprocessor.preprocess("Hello! Can't you explain this API error?");
    expect(output).toContain("cannot");

    const intentClassifier = new NLUIntentClassifier();
    const intent = intentClassifier.classify("Can you explain how this API works?");
    expect(intent.primaryIntent).toBe(IntentCategory.EXPLANATION);

    const pipeline = new NLUPipeline();
    const result = pipeline.analyze("Please debug this code deployment pipeline failure");
    expect(result.topics.primaryTopic).toBe(TopicCategory.PROGRAMMING);
    expect(result.intent.primaryIntent).not.toBe(IntentCategory.UNKNOWN);
  });

  it("extracts entities and sentiment with deterministic outputs", () => {
    const extractor = new NLUEntityExtractor();
    const entities = extractor.extract(
      "Contact me at dev@citadel-nexus.com and run /status on v1.2.3",
    );
    expect(entities.some((entity) => entity.entityType === EntityType.EMAIL)).toBe(true);
    expect(entities.some((entity) => entity.entityType === EntityType.COMMAND)).toBe(true);
    expect(entities.some((entity) => entity.entityType === EntityType.VERSION)).toBe(true);

    const sentimentAnalyzer = new NLUSentimentAnalyzer();
    const positive = sentimentAnalyzer.analyze("Great job, this is an excellent and helpful fix");
    const negative = sentimentAnalyzer.analyze("This is a terrible and frustrating bug");
    expect(positive.score).toBeGreaterThan(0);
    expect(negative.score).toBeLessThan(0);
  });

  it("detects language, computes similarity, and supports cache behavior", () => {
    const pipeline = new NLUPipeline(60_000);
    const first = pipeline.analyze("Bonjour le système est prêt pour la production");
    expect([LanguageCode.FR, LanguageCode.EN]).toContain(first.language.primaryLanguage);

    const second = pipeline.analyze("Bonjour le système est prêt pour la production");
    expect(second.originalText).toBe(first.originalText);
    expect(pipeline.getStats().cacheSize).toBeGreaterThan(0);

    const similarity = new NLUTextSimilarity();
    expect(
      similarity.jaccardSimilarity("deploy pipeline health", "pipeline health check"),
    ).toBeGreaterThan(0);
    expect(similarity.normalizedLevenshtein("agent", "agents")).toBeGreaterThan(0.5);
  });
});