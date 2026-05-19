import { describe, expect, it } from "vitest";

import {
  DiscordBroadcaster,
  MultiChannelBroadcaster,
  type GitLabCommitRecord,
} from "../../../src/agents/nexus-tamagotchi/multi-channel-broadcast.js";

type RoutedCall = {
  service: string;
  action: string;
  payload: Record<string, unknown>;
};

class StubRouter {
  readonly calls: RoutedCall[] = [];

  constructor(
    private readonly availability: Record<string, boolean> = {
      discord: true,
      linear: true,
      notion: true,
      gitlab: true,
    },
  ) {}

  isAvailable(service: string): boolean {
    return this.availability[service] ?? false;
  }

  async route(
    service: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    service: string;
    action: string;
    timestamp: string;
    payloadKeys: string[];
  }> {
    this.calls.push({ service, action, payload });
    return {
      success: true,
      service,
      action,
      timestamp: new Date().toISOString(),
      payloadKeys: Object.keys(payload),
    };
  }
}

describe("multi-channel broadcast integration wrappers", () => {
  it("broadcasts Discord rank-up notifications when available", async () => {
    const router = new StubRouter();
    const broadcaster = new DiscordBroadcaster(router);

    const result = await broadcaster.broadcastRankUp(
      "Aurora",
      "INITIATE",
      "APPRENTICE",
      950,
    );

    expect(result.success).toBe(true);
    expect(result.channel).toBe("discord");
    expect(router.calls.some((call) => call.action === "post_rank_up")).toBe(
      true,
    );
  });

  it("coordinates Discord + Slack achievement fan-out", async () => {
    const router = new StubRouter();
    const slackCalls: string[] = [];
    const integrations = {
      sendSlackMessage: async (
        channel: string,
        message: string,
      ): Promise<boolean> => {
        slackCalls.push(`${channel}:${message}`);
        return true;
      },
    };

    const broadcaster = new MultiChannelBroadcaster(integrations, router);
    const results = await broadcaster.broadcastAchievement("Aurora", "badge", {
      badge_name: "First Contact",
      badge_description: "Complete first interaction",
    });

    expect(results.discord?.success).toBe(true);
    expect(results.slack?.success).toBe(true);
    expect(slackCalls.length).toBe(1);
  });

  it("uses GitLab loader cache for summaries", async () => {
    const router = new StubRouter();
    const broadcaster = new MultiChannelBroadcaster(undefined, router);

    const commits: GitLabCommitRecord[] = [
      { id: "a1", title: "Add mission runtime", authorName: "nexus" },
      { id: "a2", title: "Extend insight engine", authorName: "nexus" },
    ];
    broadcaster.gitlab.setCommitCache(commits);

    const recent = await broadcaster.gitlab.getRecentCommits(7, 2);
    expect(recent.length).toBe(2);
    expect(broadcaster.gitlab.getCommitSummary()).toContain("Recent commits");
  });
});
