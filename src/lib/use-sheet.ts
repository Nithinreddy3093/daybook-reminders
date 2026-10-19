import { useEffect } from "react";

/** Lock page scroll while a bottom sheet is open so the page never jumps. */
export function useScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const y = window.scrollY;
    const b = document.body.style;
    const prev = { position: b.position, top: b.top, width: b.width, overflow: b.overflow };
    Object.assign(b, { position: "fixed", top: `-${y}px`, width: "100%", overflow: "hidden" });
    return () => { Object.assign(b, prev); window.scrollTo(0, y); };
  }, [open]);
}
