// Server-only helper: import dynamically inside server handlers.
import { buildPushPayload } from "@block65/webcrypto-web-push";

export type SubRow = { id: string; endpoint: string; p256dh: string; auth: string };
export type PushData = { title: string; body: string; url?: string; tag?: string };

/** Sends one push. Returns "gone" when the device subscription expired and should be deleted. */
export async function sendPush(sub: SubRow, data: PushData): Promise<"ok" | "gone" | "error"> {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  if (!publicKey || !privateKey) throw new Error("Push keys missing");
  const payload = await buildPushPayload(
    { data, options: { ttl: 60 * 60 * 12, urgency: "high", topic: (data.tag ?? "keep").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "keep" } },
    { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    { subject: "mailto:reminders@keep.app", publicKey, privateKey },
  );
  const res = await fetch(sub.endpoint, payload);
  if (res.status === 404 || res.status === 410) return "gone";
  return res.ok ? "ok" : "error";
}
