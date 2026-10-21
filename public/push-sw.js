// Keep push-notification worker. Handles background reminders only; it does not cache the app.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  event.waitUntil((async () => {
    // If Keep is open, let the page play its own chime too.
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const url = d.url || "/home";
    const visible = list.filter((c) => c.visibilityState === "visible");
    // Already looking at this chat: no alert.
    if (url.startsWith("/chat/") && visible.some((c) => new URL(c.url).pathname === url)) return;
    // Keep is open on another screen: the in-app pop-up handles chat messages.
    if (url.startsWith("/chat/") && visible.length) return;
    list.forEach((c) => c.postMessage({ type: "keep-push", sound: d.sound || "reminder" }));
    await self.registration.showNotification(d.title || "Keep", {
      body: d.body || "",
      icon: "/icon-512.png",
      badge: "/icon-512.png",
      tag: d.tag || "keep",
      renotify: true,
      silent: false,
      requireInteraction: true,
      sound: "/sounds/chime.wav",
      vibrate: [250, 100, 250, 100, 400],
      data: { url: d.url || "/home" },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/home";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});
