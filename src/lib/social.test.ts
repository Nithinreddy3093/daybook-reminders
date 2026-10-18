import { describe, it, expect } from "vitest";
import { liveStreak } from "./social";

const now = new Date("2026-10-18T10:00:00Z");
describe("liveStreak", () => {
  it("keeps streak when active today", () => expect(liveStreak({ streak: 5, last_active: "2026-10-18" }, now)).toBe(5));
  it("keeps streak when active yesterday", () => expect(liveStreak({ streak: 5, last_active: "2026-10-17" }, now)).toBe(5));
  it("resets when inactive 2+ days", () => expect(liveStreak({ streak: 5, last_active: "2026-10-16" }, now)).toBe(0));
});
