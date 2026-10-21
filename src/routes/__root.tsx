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
import { SPLASH_LOGO } from "../lib/splash-logo";

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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(document.getElementById("keep-splash"))return;var el=document.createElement("div");el.id="keep-splash";el.setAttribute("aria-hidden","true");el.innerHTML='<img alt="" class="keep-splash-logo" width="96" height="96" decoding="sync"><div class="keep-splash-word">Keep</div><div class="keep-splash-tap">Tap to start</div>';el.firstChild.src=${JSON.stringify(SPLASH_LOGO)};document.documentElement.appendChild(el);var start=Date.now(),hidden=false,needTap=false,ready=false;function hide(){if(hidden)return;hidden=true;el.classList.add("keep-splash-hide");setTimeout(function(){el.remove()},400)}function check(){if(hidden)return;if(ready&&!needTap&&Date.now()-start>=900)hide()}window.__keepSplashReady=function(){ready=true;check();setTimeout(check,950)};setTimeout(hide,needTap?4000:3000);var soundOn=true;try{soundOn=localStorage.getItem("keep-sound")!=="off"}catch(e){}var C=soundOn&&(window.AudioContext||window.webkitAudioContext);if(!C)return;var a,played=false;try{a=new C()}catch(e){return}function play(){if(played)return;played=true;var t=a.currentTime+.02;[523.25,659.25,783.99,1046.5].forEach(function(f,i){var o=a.createOscillator(),g=a.createGain();o.type="sine";o.frequency.value=f;g.gain.setValueAtTime(0,t+i*.1);g.gain.linearRampToValueAtTime(.14,t+i*.1+.02);g.gain.exponentialRampToValueAtTime(.0001,t+i*.1+.9);o.connect(g);g.connect(a.destination);o.start(t+i*.1);o.stop(t+i*.1+1)})}function onTap(){rm();try{a.resume()}catch(e){}play();if(needTap){needTap=false;el.classList.remove("keep-splash-needtap");hide()}}function rm(){["pointerdown","touchstart","keydown"].forEach(function(e){window.removeEventListener(e,onTap,true)})}["pointerdown","touchstart","keydown"].forEach(function(e){window.addEventListener(e,onTap,{capture:true,passive:true})});setTimeout(rm,5000);var p;try{p=a.resume()}catch(e){}Promise.resolve(p).then(function(){if(a.state==="running")play();else{needTap=true;el.classList.add("keep-splash-needtap");setTimeout(function(){needTap=false;check();setTimeout(hide,300)},4000)}}).catch(function(){})})();`,
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

  // Tell the splash the first screen has painted, so it fades straight into the app.
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      (window as unknown as { __keepSplashReady?: () => void }).__keepSplashReady?.();
    }));
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
