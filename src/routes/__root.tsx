import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, interactive-widget=resizes-content" },
      { title: "Keep — plan, remember, get reminded" },
      { name: "description", content: "A minimal personal space to plan, remember and get reminded." },
      { name: "theme-color", content: "#ffffff" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("keep-theme");if(t==="dark"||t==="oled")document.documentElement.classList.add("dark");if(t==="oled")document.documentElement.classList.add("oled")}catch(e){}`,
          }}
        />
      </head>
      <body>
        <div id="keep-splash" aria-hidden="true" suppressHydrationWarning>
          <img src="/icon-512.png" alt="" className="keep-splash-logo" width={96} height={96} />
          <div className="keep-splash-word">Keep</div>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem("keep-splash"))document.getElementById("keep-splash").style.display="none";else{sessionStorage.setItem("keep-splash","1");if(localStorage.getItem("keep-sound")!=="off"){var C=window.AudioContext||window.webkitAudioContext;if(C){var a=new C(),play=function(){var t=a.currentTime;[523.25,659.25,783.99,1046.5].forEach(function(f,i){var o=a.createOscillator(),g=a.createGain();o.type="sine";o.frequency.value=f;g.gain.setValueAtTime(0,t+i*.12);g.gain.linearRampToValueAtTime(.12,t+i*.12+.03);g.gain.exponentialRampToValueAtTime(.0001,t+i*.12+1.1);o.connect(g);g.connect(a.destination);o.start(t+i*.12);o.stop(t+i*.12+1.2)})};if(a.state==="running")play();else a.resume().then(function(){if(a.state==="running")play()}).catch(function(){})}}}}catch(e){}`,
          }}
        />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Remove the splash once it fades so it never blocks taps (important in home-screen mode).
  useEffect(() => {
    const el = document.getElementById("keep-splash");
    if (!el) return;
    const kill = () => el.remove();
    el.addEventListener("animationend", (e) => { if (e.animationName === "keep-splash-out") kill(); });
    const t = setTimeout(kill, 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
