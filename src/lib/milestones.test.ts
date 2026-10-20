import { describe, expect, it } from "vitest";
import { milestoneFor } from "./milestones";

describe("streak milestones", () => {
  it("no celebration below 7 days", () => expect(milestoneFor(6)).toBeNull());
  it("7 days celebrates 7", () => expect(milestoneFor(7)).toBe(7));
  it("15 days celebrates 15", () => expect(milestoneFor(16)).toBe(15));
  it("30 days celebrates 30", () => expect(milestoneFor(30)).toBe(30));
});
