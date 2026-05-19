import { randomUUID } from "node:crypto";

import {
  CITADEL_ROUTER,
  type CitadelIntegrationRouter,
  type IntegrationRouteResult,
} from "./integration-router.js";
import type { WeeklyReport } from "./insight.js";
import type { IntegrationsManager } from "./integrations-manager.js";
import type { MissionRecord } from "./missions.js";

type RouterAdapter = Pick<CitadelIntegrationRouter, "isAvailable" | "route">;

export type BroadcastResult = {
  channel: string;
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: string;
};

export type GitLabCommitRecord = {
  id: string;
  title: string;
  authorName: string;
};

export type GitLabMergeRequestRecord = {
  id: string;
  title: string;
  state: string;
};

function routeToBroadcastResult(
  channel: string,
  result: IntegrationRouteResult,
): BroadcastResult {
  return {
    channel,
    success: result.success,
    messageId: result.success ? randomUUID() : undefined,
    error: result.success ? undefined : (result.error ?? "Request failed"),
    timestamp: result.timestamp ?? new Date().toISOString(),
  };
}

export class DiscordBroadcaster {
  readonly broadcastHistory: BroadcastResult[] = [];

  constructor(private readonly router: RouterAdapter = CITADEL_ROUTER) {}

  async broadcastRankUp(
    userName: string,
    oldRank: string,
    newRank: string,
    xp: number,
  ): Promise<BroadcastResult> {
    return this.send("post_rank_up", {
      user_name: userName,
      old_rank: oldRank,
      new_rank: newRank,
      xp,
    });
  }

  async broadcastBadgeUnlock(
    userName: string,
    badgeName: string,
    badgeDescription: string,
  ): Promise<BroadcastResult> {
    return this.send("post_badge_unlock", {
      user_name: userName,
      badge_name: badgeName,
      badge_description: badgeDescription,
    });
  }

  private async send(
    action: string,
    payload: Record<string, unknown>,
  ): Promise<BroadcastResult> {
    if (!this.router.isAvailable("discord")) {
      const unavailable: BroadcastResult = {
        channel: "discord",
        success: false,
        error: "Discord integration is not configured",
        timestamp: new Date().toISOString(),
      };
      this.broadcastHistory.push(unavailable);
      return unavailable;
    }

    const routed = await this.router.route("discord", action, payload);
    const result = routeToBroadcastResult("discord", routed);
    this.broadcastHistory.push(result);
    return result;
  }
}

export class LinearIntegration {
  readonly createdIssues = new Map<string, string>();

  constructor(private readonly router: RouterAdapter = CITADEL_ROUTER) {}

  async createIssueFromMission(
    missionTitle: string,
    missionDescription: string,
    priority: number = 3,
  ): Promise<string | undefined> {
    if (!this.router.isAvailable("linear")) {
      return undefined;
    }

    const routed = await this.router.route("linear", "create_issue", {
      title: `[Mission] ${missionTitle}`,
      description: missionDescription,
      priority,
    });
    if (!routed.success) {
      return undefined;
    }

    const issueId = `LIN-${randomUUID().slice(0, 8).toUpperCase()}`;
    this.createdIssues.set(missionTitle, issueId);
    return issueId;
  }

  async updateIssueStatus(
    issueId: string,
    status: string = "done",
  ): Promise<boolean> {
    if (!this.router.isAvailable("linear")) {
      return false;
    }

    const routed = await this.router.route("linear", "update_issue_status", {
      issue_id: issueId,
      status,
    });
    return routed.success;
  }
}

export class NotionKnowledgeSync {
  readonly publishedPages: string[] = [];

  constructor(private readonly router: RouterAdapter = CITADEL_ROUTER) {}

  async publishFinding(
    professor: string,
    findingTitle: string,
    findingContent: string,
  ): Promise<string | undefined> {
    if (!this.router.isAvailable("notion")) {
      return undefined;
    }

    const routed = await this.router.route("notion", "create_page", {
      professor,
      title: findingTitle,
      content: findingContent,
    });
    if (!routed.success) {
      return undefined;
    }

    const pageId = randomUUID();
    this.publishedPages.push(pageId);
    return pageId;
  }

  async publishWeeklyReport(report: WeeklyReport): Promise<string | undefined> {
    const title = `Weekly Report: ${report.periodStart.slice(0, 10)} to ${report.periodEnd.slice(0, 10)}`;
    const insightLines = report.insights.map(
      (insight) => `- ${insight.title}: ${insight.description}`,
    );
    const suggestionLines = report.suggestions.map(
      (suggestion) =>
        `- [${suggestion.priority}] ${suggestion.area}: ${suggestion.suggestion}`,
    );
    const content = [
      `Interactions: ${report.interactions}`,
      `XP Earned: ${report.xpEarned}`,
      `TP Earned: ${report.tpEarned}`,
      `Rank Changes: ${report.rankChanges}`,
      "",
      "Insights:",
      ...insightLines,
      "",
      "Suggestions:",
      ...suggestionLines,
    ].join("\n");
    return this.publishFinding("System", title, content);
  }
}

export class GitLabContextLoader {
  private commitsCache: GitLabCommitRecord[] = [];
  private mergeRequestsCache: GitLabMergeRequestRecord[] = [];

  constructor(private readonly router: RouterAdapter = CITADEL_ROUTER) {}

  setCommitCache(commits: GitLabCommitRecord[]): void {
    this.commitsCache = commits.map((commit) => ({ ...commit }));
  }

  setMergeRequestCache(mergeRequests: GitLabMergeRequestRecord[]): void {
    this.mergeRequestsCache = mergeRequests.map((mergeRequest) => ({
      ...mergeRequest,
    }));
  }

  async getRecentCommits(
    days: number = 7,
    limit: number = 20,
  ): Promise<GitLabCommitRecord[]> {
    if (this.router.isAvailable("gitlab")) {
      await this.router.route("gitlab", "list_recent_commits", { days, limit });
    }
    return this.commitsCache.slice(0, Math.max(0, limit));
  }

  getCommitSummary(): string {
    if (this.commitsCache.length === 0) {
      return "No recent commits found.";
    }

    const summaryLines: string[] = [
      `Recent commits (${this.commitsCache.length}):`,
    ];
    for (const commit of this.commitsCache.slice(0, 5)) {
      summaryLines.push(`  - ${commit.title} (${commit.authorName})`);
    }
    return summaryLines.join("\n");
  }

  async getRecentMergeRequests(
    state: string = "merged",
    limit: number = 10,
  ): Promise<GitLabMergeRequestRecord[]> {
    if (this.router.isAvailable("gitlab")) {
      await this.router.route("gitlab", "list_recent_merge_requests", {
        state,
        limit,
      });
    }
    return this.mergeRequestsCache
      .filter((mergeRequest) => mergeRequest.state === state)
      .slice(0, Math.max(0, limit));
  }
}

export type AchievementType = "rank_up" | "badge";

export class MultiChannelBroadcaster {
  readonly discord: DiscordBroadcaster;
  readonly linear: LinearIntegration;
  readonly notion: NotionKnowledgeSync;
  readonly gitlab: GitLabContextLoader;
  readonly broadcastLog: Array<{
    user: string;
    type: AchievementType;
    details: Record<string, unknown>;
    results: Record<string, boolean>;
    timestamp: string;
  }> = [];

  constructor(
    private readonly integrations?: Pick<
      IntegrationsManager,
      "sendSlackMessage"
    >,
    router: RouterAdapter = CITADEL_ROUTER,
  ) {
    this.discord = new DiscordBroadcaster(router);
    this.linear = new LinearIntegration(router);
    this.notion = new NotionKnowledgeSync(router);
    this.gitlab = new GitLabContextLoader(router);
  }

  async broadcastAchievement(
    userName: string,
    achievementType: AchievementType,
    details: Record<string, unknown>,
  ): Promise<Record<string, BroadcastResult>> {
    const results: Record<string, BroadcastResult> = {};

    if (achievementType === "rank_up") {
      const oldRank =
        typeof details.old_rank === "string" ? details.old_rank : "";
      const newRank =
        typeof details.new_rank === "string" ? details.new_rank : "";
      const xp = typeof details.xp === "number" ? details.xp : 0;
      results.discord = await this.discord.broadcastRankUp(
        userName,
        oldRank,
        newRank,
        xp,
      );
    } else if (achievementType === "badge") {
      const badgeName =
        typeof details.badge_name === "string" ? details.badge_name : "";
      const badgeDescription =
        typeof details.badge_description === "string"
          ? details.badge_description
          : "";
      results.discord = await this.discord.broadcastBadgeUnlock(
        userName,
        badgeName,
        badgeDescription,
      );
    }

    if (this.integrations) {
      const slackSuccess = await this.integrations.sendSlackMessage(
        "#achievements",
        `[${achievementType}] ${userName}: ${JSON.stringify(details)}`,
      );
      results.slack = {
        channel: "slack",
        success: slackSuccess,
        error: slackSuccess ? undefined : "Slack integration unavailable",
        timestamp: new Date().toISOString(),
      };
    }

    this.broadcastLog.push({
      user: userName,
      type: achievementType,
      details: { ...details },
      results: Object.fromEntries(
        Object.entries(results).map(([channel, result]) => [
          channel,
          result.success,
        ]),
      ),
      timestamp: new Date().toISOString(),
    });

    return results;
  }

  async syncMissionToLinear(
    mission: Pick<MissionRecord, "title" | "description" | "requirements">,
  ): Promise<string | undefined> {
    return this.linear.createIssueFromMission(
      mission.title,
      `${mission.description}\n\nRequirements: ${JSON.stringify(mission.requirements)}`,
    );
  }

  async publishToNotion(
    title: string,
    content: string,
    category: string = "General",
  ): Promise<string | undefined> {
    return this.notion.publishFinding(category, title, content);
  }
}
