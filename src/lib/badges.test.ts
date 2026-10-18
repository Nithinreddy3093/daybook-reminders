import { describe, it, expect } from "vitest";
import { BADGES, memoryStreak } from "./badges";

const unlocked = (s: { doneTasks: number; memories: number; streak: number }) => BADGES.filter((b) => b.test(s)).map((b) => b.id);

describe("badges", () => {
  it("unlocks Productivity Pro at 25 done tasks", () => {
    expect(unlocked({ doneTasks: 24, memories: 0, streak: 0 })).not.toContain("productivity-pro");
    expect(unlocked({ doneTasks: 25, memories: 0, streak: 0 })).toContain("productivity-pro");
  });
  it("unlocks Memory Archivist at 50 memories", () => {
    expect(unlocked({ doneTasks: 0, memories: 50, streak: 0 })).toContain("memory-archivist");
  });
  it("counts consecutive days for streak", () => {
    const today = new Date(2026, 9, 18, 12);
    const d = (n: number) => new Date(2026, 9, 18 - n, 10).toISOString();
    expect(memoryStreak([d(0), d(1), d(2), d(4)], today)).toBe(3);
  });
});
