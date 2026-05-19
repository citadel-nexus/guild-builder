import { describe, expect, it, vi } from "vitest";

import {
  ConversationFlowManager,
  IntentClassifier,
  SentimentAnalyzer,
  TopicDetector,
} from "../../../src/agents/nexus-tamagotchi/conversation-flow.js";

describe("conversation-flow", () => {
  it("classifies intent and sentiment", () => {
    const intentClassifier = new IntentClassifier();
    const sentimentAnalyzer = new SentimentAnalyzer();

    expect(intentClassifier.classify("Can you help me debug this?")).toBe("request");
    expect(intentClassifier.classify("Please create a plan")).toBe("request");

    const positive = sentimentAnalyzer.analyze("Great work, this is helpful");
    expect(positive.sentiment).toBe("positive");

    const negative = sentimentAnalyzer.analyze("This is confusing and bad");
    expect(negative.sentiment).toBe("negative");
  });

  it("detects topics from messages", () => {
    const detector = new TopicDetector();
    const topics = detector.detect("I need to debug a software error in this API");
    expect(topics).toContain("technology");
    expect(topics).toContain("problem_solving");
  });

  it("tracks conversation state, pruning, and summaries", () => {
    const persistConversation = vi.fn();
    const manager = new ConversationFlowManager({
      maxContextTurns: 2,
      maxContextTokens: 1000,
      conversationIdFactory: () => "conversation-1",
      now: () => new Date("2026-01-14T00:00:00.000Z"),
      persistConversation,
    });

    manager.addTurn("user", "What is the deployment status?");
    manager.addTurn("user", "Create a software task for deployment");
    manager.addTurn("assistant", "Sure, I can help");

    const stats = manager.getStats();
    expect(stats.currentTurns).toBe(2);

    const context = manager.getContext(2);
    expect(context.length).toBe(2);
    expect(context[0].role).toBe("user");
    expect(context[1].role).toBe("assistant");

    const state = manager.getState();
    expect(state.pendingQuestions.length).toBe(1);
    expect(state.pendingTasks.length).toBe(1);
    manager.markQuestionAnswered("What is the deployment status?");
    manager.markTaskCompleted("Create a software task for deployment");
    const updatedState = manager.getState();
    expect(updatedState.pendingQuestions.length).toBe(0);
    expect(updatedState.pendingTasks.length).toBe(0);

    const summary = manager.endConversation();
    expect(summary.totalTurns).toBe(2);
    expect(summary.topicsDiscussed).toContain("technology");
    expect(persistConversation).toHaveBeenCalledTimes(1);
    expect(persistConversation.mock.calls[0]?.[0]?.id).toBe("conversation-1");
  });
});
