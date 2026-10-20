export const MILESTONES = [7, 15, 30, 50, 100, 365];
/** Highest milestone reached by this streak, or null. */
export const milestoneFor = (streak: number) => [...MILESTONES].reverse().find((m) => streak >= m) ?? null;
