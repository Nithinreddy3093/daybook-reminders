export type BadgeInput = { doneTasks: number; memories: number; streak: number };

export const BADGES = [
  { id: "first-step", label: "First Step", emoji: "🌱", hint: "Complete 1 task", test: (s: BadgeInput) => s.doneTasks >= 1 },
  { id: "productivity-pro", label: "Productivity Pro", emoji: "⚡", hint: "Complete 25 tasks", test: (s: BadgeInput) => s.doneTasks >= 25 },
  { id: "memory-keeper", label: "Memory Keeper", emoji: "📸", hint: "Save 10 memories", test: (s: BadgeInput) => s.memories >= 10 },
  { id: "memory-archivist", label: "Memory Archivist", emoji: "🗂️", hint: "Save 50 memories", test: (s: BadgeInput) => s.memories >= 50 },
  { id: "streak-starter", label: "Streak Starter", emoji: "🔥", hint: "3-day memory streak", test: (s: BadgeInput) => s.streak >= 3 },
  { id: "streak-master", label: "Streak Master", emoji: "🏆", hint: "7-day memory streak", test: (s: BadgeInput) => s.streak >= 7 },
];

export function memoryStreak(dates: string[], today = new Date()) {
  const keys = new Set(dates.map((d) => new Date(d).toDateString()));
  let n = 0;
  for (const d = new Date(today); keys.has(d.toDateString()); d.setDate(d.getDate() - 1)) n++;
  return n;
}
