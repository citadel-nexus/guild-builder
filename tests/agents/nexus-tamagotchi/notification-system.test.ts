import { describe, expect, it, vi } from "vitest";

import {
  NotificationManager,
  NotificationTemplateRegistry,
} from "../../../src/agents/nexus-tamagotchi/notification-system.js";

describe("notification-system", () => {
  it("creates notifications from templates and delivers through handlers", async () => {
    const deliverySpy = vi.fn(async () => true);
    const manager = new NotificationManager({
      now: () => new Date("2026-01-14T00:00:00.000Z"),
      deliveryHandlers: {
        push: deliverySpy,
      },
    });

    const notification = manager.createFromTemplate("mission_complete", {
      mission_name: "Daily Foundations",
      xp: 100,
      tp: 20,
    });
    expect(notification).toBeDefined();
    expect(manager.getPendingCount()).toBe(1);

    await manager.processPending();
    expect(deliverySpy).toHaveBeenCalledTimes(1);
    expect(manager.getPendingCount()).toBe(0);

    const stats = manager.getDeliveryStats();
    expect(stats.totalDelivered).toBe(1);
  });

  it("respects user channel preferences", async () => {
    const pushSpy = vi.fn(async () => true);
    const emailSpy = vi.fn(async () => true);
    const manager = new NotificationManager({
      deliveryHandlers: {
        push: pushSpy,
        email: emailSpy,
      },
    });
    manager.setUserPreferences({
      userId: "user-1",
      enabledChannels: ["push"],
      enabledCategories: ["achievement", "alert", "reminder", "system", "update"],
      digestMode: false,
      digestFrequency: "daily",
    });

    const notification = manager.createCustom({
      subject: "Status",
      body: "Payload",
      channels: ["push", "email"],
      recipientId: "user-1",
    });
    await manager.deliver(notification.id);
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy).toHaveBeenCalledTimes(0);
  });

  it("exposes template registry defaults", () => {
    const registry = new NotificationTemplateRegistry();
    expect(registry.get("rank_up")).toBeDefined();
    expect(registry.getByCategory("achievement").length).toBeGreaterThan(0);
  });
});
