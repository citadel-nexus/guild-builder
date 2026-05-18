import { randomUUID } from "node:crypto";

export type NotificationChannel =
  | "email"
  | "slack"
  | "discord"
  | "push"
  | "notion";

export type NotificationTemplate = {
  id: string;
  name: string;
  category: "achievement" | "alert" | "update" | "reminder" | "system";
  subjectTemplate: string;
  bodyTemplate: string;
  channels: NotificationChannel[];
  priority: "low" | "normal" | "high" | "urgent";
  variables: string[];
};

export type Notification = {
  id: string;
  templateId?: string;
  category: NotificationTemplate["category"];
  subject: string;
  body: string;
  channels: NotificationChannel[];
  priority: NotificationTemplate["priority"];
  recipientId?: string;
  scheduledFor?: string;
  createdAt: string;
  deliveredAt?: string;
  status: "pending" | "delivered" | "failed";
  deliveryResults: Record<string, string>;
  metadata: Record<string, unknown>;
};

export type NotificationPreference = {
  userId: string;
  enabledChannels: NotificationChannel[];
  enabledCategories: NotificationTemplate["category"][];
  quietHoursStart?: string;
  quietHoursEnd?: string;
  digestMode: boolean;
  digestFrequency: "daily" | "weekly";
};

export type NotificationDeliveryHandler = (
  notification: Notification,
) => Promise<boolean> | boolean;

function nowIso(now: () => Date): string {
  return now().toISOString();
}

function fillTemplate(
  template: string,
  variables: Record<string, unknown>,
): string {
  let output = template;
  for (const [key, value] of Object.entries(variables)) {
    output = output.replaceAll(`{${key}}`, String(value));
  }
  return output;
}

export class NotificationTemplateRegistry {
  private readonly templates = new Map<string, NotificationTemplate>();

  constructor() {
    this.registerDefaults();
  }

  register(template: NotificationTemplate): void {
    this.templates.set(template.id, {
      ...template,
      channels: [...template.channels],
      variables: [...template.variables],
    });
  }

  get(templateId: string): NotificationTemplate | undefined {
    const template = this.templates.get(templateId);
    if (!template) {
      return undefined;
    }
    return {
      ...template,
      channels: [...template.channels],
      variables: [...template.variables],
    };
  }

  getByCategory(
    category: NotificationTemplate["category"],
  ): NotificationTemplate[] {
    return Array.from(this.templates.values())
      .filter((template) => template.category === category)
      .map((template) => ({
        ...template,
        channels: [...template.channels],
        variables: [...template.variables],
      }));
  }

  listAll(): NotificationTemplate[] {
    return Array.from(this.templates.values()).map((template) => ({
      ...template,
      channels: [...template.channels],
      variables: [...template.variables],
    }));
  }

  private registerDefaults(): void {
    this.register({
      id: "rank_up",
      name: "Rank Up Notification",
      category: "achievement",
      subjectTemplate: "Congratulations! You've ranked up!",
      bodyTemplate:
        "You've advanced from {old_rank} to {new_rank}. Total XP: {xp_total}.",
      channels: ["discord", "slack", "push"],
      priority: "high",
      variables: ["old_rank", "new_rank", "xp_total"],
    });
    this.register({
      id: "badge_unlock",
      name: "Badge Unlocked",
      category: "achievement",
      subjectTemplate: "New badge unlocked: {badge_name}",
      bodyTemplate:
        "You earned '{badge_name}'. {badge_description} (+{badge_xp} XP)",
      channels: ["discord", "push"],
      priority: "normal",
      variables: ["badge_name", "badge_description", "badge_xp"],
    });
    this.register({
      id: "mission_complete",
      name: "Mission Complete",
      category: "achievement",
      subjectTemplate: "Mission complete: {mission_name}",
      bodyTemplate:
        "Mission '{mission_name}' completed. Rewards: +{xp} XP, +{tp} TP.",
      channels: ["push"],
      priority: "normal",
      variables: ["mission_name", "xp", "tp"],
    });
    this.register({
      id: "daily_quest_reminder",
      name: "Daily Quest Reminder",
      category: "reminder",
      subjectTemplate: "Daily quests available",
      bodyTemplate:
        "You have {quest_count} daily quests remaining. Keep the streak alive.",
      channels: ["push"],
      priority: "low",
      variables: ["quest_count"],
    });
    this.register({
      id: "streak_at_risk",
      name: "Streak At Risk",
      category: "alert",
      subjectTemplate: "Your streak is at risk",
      bodyTemplate:
        "Your {streak_days}-day streak may expire soon. Check in to preserve it.",
      channels: ["push", "email"],
      priority: "high",
      variables: ["streak_days"],
    });
    this.register({
      id: "weekly_report",
      name: "Weekly Progress Report",
      category: "update",
      subjectTemplate: "Weekly progress report",
      bodyTemplate:
        "This week: {interactions} interactions, +{xp_earned} XP, {badges_earned} badges.",
      channels: ["email"],
      priority: "normal",
      variables: ["interactions", "xp_earned", "badges_earned"],
    });
    this.register({
      id: "system_alert",
      name: "System Alert",
      category: "system",
      subjectTemplate: "System alert: {alert_type}",
      bodyTemplate: "{alert_message}",
      channels: ["push"],
      priority: "urgent",
      variables: ["alert_type", "alert_message"],
    });
  }
}

export type NotificationManagerOptions = {
  now?: () => Date;
  deliveryHandlers?: Partial<
    Record<NotificationChannel, NotificationDeliveryHandler>
  >;
  templateRegistry?: NotificationTemplateRegistry;
};

function defaultPreference(userId: string): NotificationPreference {
  return {
    userId,
    enabledChannels: ["push"],
    enabledCategories: ["achievement", "alert", "reminder"],
    digestMode: false,
    digestFrequency: "daily",
  };
}

export class NotificationManager {
  private readonly now: () => Date;

  private readonly templateRegistry: NotificationTemplateRegistry;

  private readonly pendingNotifications: Notification[] = [];

  private readonly deliveredNotifications: Notification[] = [];

  private readonly userPreferences = new Map<string, NotificationPreference>();

  private readonly deliveryHandlers = new Map<
    NotificationChannel,
    NotificationDeliveryHandler
  >();

  constructor(options: NotificationManagerOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.templateRegistry =
      options.templateRegistry ?? new NotificationTemplateRegistry();
    this.registerDefaultHandlers();
    for (const [channel, handler] of Object.entries(
      options.deliveryHandlers ?? {},
    )) {
      if (handler) {
        this.registerDeliveryHandler(channel as NotificationChannel, handler);
      }
    }
  }

  registerDeliveryHandler(
    channel: NotificationChannel,
    handler: NotificationDeliveryHandler,
  ): void {
    this.deliveryHandlers.set(channel, handler);
  }

  createFromTemplate(
    templateId: string,
    variables: Record<string, unknown>,
    options: { recipientId?: string; scheduleFor?: Date } = {},
  ): Notification | undefined {
    const template = this.templateRegistry.get(templateId);
    if (!template) {
      return undefined;
    }
    const notification: Notification = {
      id: randomUUID(),
      templateId,
      category: template.category,
      subject: fillTemplate(template.subjectTemplate, variables),
      body: fillTemplate(template.bodyTemplate, variables),
      channels: [...template.channels],
      priority: template.priority,
      recipientId: options.recipientId,
      scheduledFor: options.scheduleFor?.toISOString(),
      createdAt: nowIso(this.now),
      status: "pending",
      deliveryResults: {},
      metadata: { variables: { ...variables } },
    };
    this.pendingNotifications.push(notification);
    return this.cloneNotification(notification);
  }

  createCustom(input: {
    subject: string;
    body: string;
    channels: NotificationChannel[];
    category?: NotificationTemplate["category"];
    priority?: NotificationTemplate["priority"];
    recipientId?: string;
  }): Notification {
    const notification: Notification = {
      id: randomUUID(),
      category: input.category ?? "system",
      subject: input.subject,
      body: input.body,
      channels: [...input.channels],
      priority: input.priority ?? "normal",
      recipientId: input.recipientId,
      createdAt: nowIso(this.now),
      status: "pending",
      deliveryResults: {},
      metadata: {},
    };
    this.pendingNotifications.push(notification);
    return this.cloneNotification(notification);
  }

  async deliver(notificationId: string): Promise<Record<string, string> | undefined> {
    const index = this.pendingNotifications.findIndex(
      (notification) => notification.id === notificationId,
    );
    if (index === -1) {
      return undefined;
    }
    const notification = this.pendingNotifications[index];
    const preference = notification.recipientId
      ? this.getUserPreferences(notification.recipientId)
      : undefined;
    const channelResults: Record<string, string> = {};
    for (const channel of notification.channels) {
      if (
        preference &&
        (!preference.enabledChannels.includes(channel) ||
          !preference.enabledCategories.includes(notification.category))
      ) {
        channelResults[channel] = "skipped";
        continue;
      }
      const handler = this.deliveryHandlers.get(channel);
      if (!handler) {
        channelResults[channel] = "no_handler";
        continue;
      }
      try {
        const delivered = await handler(this.cloneNotification(notification));
        channelResults[channel] = delivered ? "delivered" : "failed";
      } catch (error) {
        channelResults[channel] = `error:${String(error)}`;
      }
    }
    notification.deliveryResults = channelResults;
    notification.deliveredAt = nowIso(this.now);
    notification.status = Object.values(channelResults).some(
      (result) => result === "delivered",
    )
      ? "delivered"
      : "failed";
    this.pendingNotifications.splice(index, 1);
    this.deliveredNotifications.push(notification);
    return { ...channelResults };
  }

  async processPending(): Promise<void> {
    const dueNotifications = this.pendingNotifications
      .filter((notification) => {
        if (!notification.scheduledFor) {
          return true;
        }
        return Date.parse(notification.scheduledFor) <= this.now().getTime();
      })
      .map((notification) => notification.id);
    for (const notificationId of dueNotifications) {
      await this.deliver(notificationId);
    }
  }

  setUserPreferences(preference: NotificationPreference): void {
    this.userPreferences.set(preference.userId, {
      ...preference,
      enabledChannels: [...preference.enabledChannels],
      enabledCategories: [...preference.enabledCategories],
    });
  }

  getUserPreferences(userId: string): NotificationPreference {
    const existing = this.userPreferences.get(userId);
    if (existing) {
      return {
        ...existing,
        enabledChannels: [...existing.enabledChannels],
        enabledCategories: [...existing.enabledCategories],
      };
    }
    return defaultPreference(userId);
  }

  getPendingCount(): number {
    return this.pendingNotifications.length;
  }

  getDeliveryStats(): Record<string, unknown> {
    const byChannel: Record<string, { delivered: number; failed: number }> = {};
    const byCategory: Record<string, number> = {};
    for (const notification of this.deliveredNotifications) {
      byCategory[notification.category] =
        (byCategory[notification.category] ?? 0) + 1;
      for (const [channel, result] of Object.entries(notification.deliveryResults)) {
        const current = byChannel[channel] ?? { delivered: 0, failed: 0 };
        if (result === "delivered") {
          current.delivered += 1;
        } else if (result !== "skipped") {
          current.failed += 1;
        }
        byChannel[channel] = current;
      }
    }
    return {
      totalDelivered: this.deliveredNotifications.length,
      pending: this.pendingNotifications.length,
      byChannel,
      byCategory,
    };
  }

  getPendingNotifications(): Notification[] {
    return this.pendingNotifications.map((notification) =>
      this.cloneNotification(notification),
    );
  }

  private cloneNotification(notification: Notification): Notification {
    return {
      ...notification,
      channels: [...notification.channels],
      deliveryResults: { ...notification.deliveryResults },
      metadata: { ...notification.metadata },
    };
  }

  private registerDefaultHandlers(): void {
    const noopHandler: NotificationDeliveryHandler = async () => true;
    this.deliveryHandlers.set("discord", noopHandler);
    this.deliveryHandlers.set("slack", noopHandler);
    this.deliveryHandlers.set("push", noopHandler);
    this.deliveryHandlers.set("email", noopHandler);
    this.deliveryHandlers.set("notion", noopHandler);
  }
}
