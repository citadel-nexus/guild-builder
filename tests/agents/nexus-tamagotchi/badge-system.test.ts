import { describe, expect, it } from "vitest";

import { BadgeSystem } from "../../../src/agents/nexus-tamagotchi/badge-system.js";
import { BrotherhoodSystem } from "../../../src/agents/nexus-tamagotchi/brotherhood.js";
import { GameRank } from "../../../src/agents/nexus-tamagotchi/models.js";

describe("BadgeSystem", () => {
  it("unlocks a badge once and awards XP through brotherhood", () => {
    const brotherhood = new BrotherhoodSystem("badge-agent");
    const badges = new BadgeSystem(brotherhood);

    const unlocked = badges.checkUnlock("interaction.first_contact", true);
    expect(unlocked?.id).toBe("interaction.first_contact");
    expect(badges.getUnlockedCount()).toBe(1);
    expect(brotherhood.totalXp).toBeGreaterThan(0);

    const duplicate = badges.checkUnlock("interaction.first_contact", true);
    expect(duplicate).toBeUndefined();
    expect(badges.getUnlockedCount()).toBe(1);
  });

  it("evaluates bulk badge conditions including rank mapping", () => {
    const brotherhood = new BrotherhoodSystem("badge-agent-rank");
    const badges = new BadgeSystem(brotherhood);

    const unlocked = badges.checkAllConditions({
      interactions: 120,
      memoriesStored: 5,
      rank: GameRank.APPRENTICE,
    });

    const unlockedIds = unlocked.map((badge) => badge.id);
    expect(unlockedIds).toContain("interaction.first_contact");
    expect(unlockedIds).toContain("interaction.question_master");
    expect(unlockedIds).toContain("memory.seeded_archive");
    expect(unlockedIds).toContain("economy.rank_apprentice");
  });
});
