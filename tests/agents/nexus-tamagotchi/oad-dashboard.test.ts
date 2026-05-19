import { describe, expect, it } from "vitest";

import {
  OADPanel,
  OADServer,
  OADTheme,
  launchOAD,
} from "../../../src/agents/nexus-tamagotchi/oad-dashboard.js";

describe("oad-dashboard", () => {
  it("builds status payload and theme css from agent state", () => {
    const server = new OADServer(
      {
        brotherhood: {
          totalXp: 1234,
          totalTp: 567,
          currentRank: "EXPERT",
          streakDays: 9,
        },
        vitals: {
          interactionCount: 88,
          memoryCount: 55,
          emotionalState: "focused",
        },
      },
      { theme: OADTheme.NEXUS_PURPLE },
    );
    const payload = server.buildStatusPayload();
    expect(payload.xp).toBe(1234);
    expect(payload.rank).toBe("EXPERT");
    expect(payload.emotion).toBe("focused");

    const css = server.getThemeCssVariables();
    expect(css).toContain("--bg-primary");
    expect(css).toContain("#a855f7");
  });

  it("renders dashboard html and switches panels safely", () => {
    const server = new OADServer({}, { defaultPanel: OADPanel.OVERVIEW });
    server.switchPanel(OADPanel.CHAT);
    expect(server.state.activePanel).toBe(OADPanel.CHAT);
    server.switchPanel(OADPanel.OVERVIEW);
    expect(server.state.activePanel).toBe(OADPanel.OVERVIEW);

    const html = server.generateDashboardHtml();
    expect(html).toContain("CITADEL OAD");
    expect(html).toContain("Operator Access Dashboard");
  });

  it("starts and stops the lightweight http dashboard", async () => {
    const server = await launchOAD({}, { port: 0, autoOpen: false });
    expect(server.state.isConnected).toBe(true);
    await server.stop();
    expect(server.state.isConnected).toBe(false);
  });
});