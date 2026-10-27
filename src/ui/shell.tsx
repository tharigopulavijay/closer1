import { CalendarDays, ChevronLeft, Gamepad2, Mic, Moon, Shield, User } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useStatus } from "../state/status";
import { useStore } from "../state/store";
import { cn } from "./primitives";

const TABS = [
  { to: "/drop", label: "Drop", icon: Moon },
  { to: "/rooms", label: "Rooms", icon: Mic },
  { to: "/play", label: "Play", icon: Gamepad2 },
  { to: "/plans", label: "Plans", icon: CalendarDays },
  { to: "/you", label: "You", icon: User },
];

export function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#100914] text-cream md:py-4">
      <div className="relative mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-ink md:h-[calc(100dvh-2rem)] md:rounded-[28px] md:border md:border-line">
        {children}
      </div>
    </div>
  );
}

export function TopBar({ title, back }: { title?: string; back?: string }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useStore();
  const safety = pathname.startsWith("/safety");
  const open = state.plans.filter((plan) => plan.status === "upcoming").length;
  const cap = state.plus ? 4 : 3;
  const showBadge = state.ready && !back && !title;

  return (
    <header className="sticky top-0 z-20 border-b border-line/40 bg-ink/90 px-4 pb-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex items-center gap-1">
          {back ? (
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate(back)}
              className="grid h-11 w-11 place-items-center rounded-full border border-line bg-card text-cream"
            >
              <ChevronLeft size={20} />
            </button>
          ) : (
            <span className="font-serif text-[28px] italic leading-none text-cream">closer</span>
          )}
        </div>
        <div className="flex justify-center">
          {back && !title ? <span className="font-serif text-2xl italic leading-none text-cream">closer</span> : null}
          {title ? <h1 className="max-w-[12rem] truncate font-serif text-xl">{title}</h1> : null}
          {showBadge ? (
            <p className="rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-mute">
              Open plans {open} / {cap}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            aria-label="Safety"
            onClick={() => navigate("/safety")}
            className={cn(
              "grid h-11 w-11 place-items-center rounded-full border",
              safety ? "border-gold bg-gold/15 text-gold" : "border-mint/40 bg-mint/10 text-mint",
            )}
          >
            <Shield size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}

function tabIsOn(pathname: string, to: string) {
  if (to === "/drop") {
    return pathname === "/drop" || pathname === "/streak" || pathname.startsWith("/person/") || pathname.startsWith("/match/");
  }
  if (to === "/plans") {
    return (
      pathname === "/plans" ||
      pathname.startsWith("/plans/") ||
      pathname === "/away" ||
      pathname.startsWith("/safety/date/") ||
      pathname.startsWith("/safety/checkin/")
    );
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function TabBar() {
  const { pathname } = useLocation();
  const { state } = useStore();
  const open = state.plans.filter((plan) => plan.status === "upcoming").length;
  return (
    <nav className="grid h-16 shrink-0 grid-cols-5 border-t border-line/70 bg-ink/95 px-1 backdrop-blur-lg pb-[max(4px,env(safe-area-inset-bottom))]">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tabIsOn(pathname, tab.to);
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={cn(
              "relative flex min-h-11 flex-col items-center justify-center text-[11px] font-medium",
              isActive ? "text-gold" : "text-mute",
            )}
          >
            <span className="relative">
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? "scale-110" : undefined} />
              {tab.to === "/plans" && open > 0 ? (
                <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-0.5 text-[9px] font-extrabold text-ink">
                  {open}
                </span>
              ) : null}
            </span>
            <span className={isActive ? "font-semibold" : undefined}>{tab.label}</span>
            {isActive ? <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-gold" /> : <span className="mt-0.5 h-1.5 w-1.5" />}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function Screen({
  title,
  back,
  tab,
  children,
  bleed,
}: {
  title?: string;
  back?: string;
  tab?: boolean;
  children: ReactNode;
  bleed?: boolean;
}) {
  const status = useStatus();
  return (
    <>
      <TopBar title={title} back={back} />
      {status.loading || status.error ? (
        <p className={`px-4 py-2 text-sm ${status.error ? "text-coral" : "text-mute"}`}>
          {status.error || "Loading…"}
        </p>
      ) : null}
      <main className={cn("min-h-0 flex-1 overflow-y-auto", bleed ? "" : "px-4 pb-8")}>{children}</main>
      {tab ? <TabBar /> : null}
    </>
  );
}
