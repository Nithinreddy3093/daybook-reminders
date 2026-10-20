import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { getMyStreak } from "@/lib/social";
import { milestoneFor } from "@/lib/milestones";
import { playSound } from "@/lib/sounds";

const KEY = "keep-milestone-seen";

/** Celebrates 7 / 15 / 30 / 50 / 100 / 365-day streaks once each, when the app opens. */
export function StreakCelebration() {
  const { data: streak = 0 } = useQuery({ queryKey: ["my-streak"], queryFn: getMyStreak });
  const [show, setShow] = useState<number | null>(null);
  useEffect(() => {
    const m = milestoneFor(streak);
    if (!m) return;
    if (Number(localStorage.getItem(KEY) || 0) >= m) return;
    localStorage.setItem(KEY, String(m));
    const t = setTimeout(() => { setShow(m); playSound("reminder"); }, 900);
    return () => clearTimeout(t);
  }, [streak]);
  if (!show) return null;
  const msg = show >= 30 ? "Unstoppable. You've built a real habit." : show >= 15 ? "Two weeks strong — keep the fire going!" : "One full week! Amazing start.";
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/60 p-6" onClick={() => setShow(null)}>
      {Array.from({ length: 18 }, (_, i) => (
        <span key={i} className="keep-confetti" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.12}s`, background: ["var(--brand)", "var(--brand-2)", "var(--brand-3)"][i % 3] }} />
      ))}
      <div className="keep-bubble-in w-full max-w-xs rounded-3xl bg-background p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="keep-flame mx-auto text-7xl">🔥</div>
        <p className="mt-3 font-display text-5xl font-bold text-gradient-brand">{show}</p>
        <p className="font-display text-lg font-semibold">day streak!</p>
        <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
        <button onClick={() => setShow(null)} className="mt-5 w-full rounded-xl bg-gradient-brand py-3 font-semibold text-primary-foreground">Keep going</button>
      </div>
    </div>,
    document.body,
  );
}
