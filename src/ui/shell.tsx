import { CalendarDays, Gamepad2, Mic, Moon, Shield, User } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-ink md:min-h-[calc(100dvh-2rem)] md:overflow-hidden md:rounded-[28px] md:border md:border-line">
        {children}
      </div>
    </div>
  );
}

export function TopBar({ title, back }: { title?: string; back?: string }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const safety = pathname.startsWith("/safety");
  return (
    <header className="flex h-14 items-center gap-2 px-3">
      {back ? (
        <button type="button" onClick={() => navigate(back)} className="min-h-11 min-w-11 rounded-2xl px-2 text-sm text-mute">
          Back
        </button>
      ) : (
        <span className="w-11" />
      )}
      <h1 className="flex-1 truncate text-center text-sm font-semibold">{title}</h1>
      <button
        type="button"
        aria-label="Safety"
        onClick={() => navigate("/safety")}
        className={cn("grid h-11 w-11 place-items-center rounded-2xl", safety ? "text-gold" : "text-cream")}
      >
        <Shield size={22} />
      </button>
    </header>
  );
}

export function TabBar() {
  return (
    <nav className="sticky bottom-0 grid grid-cols-5 border-t border-line bg-ink/95 px-1 pt-1 backdrop-blur pb-[max(6px,env(safe-area-inset-bottom))]">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn("flex min-h-11 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", isActive ? "text-gold" : "text-mute")
            }
          >
            <Icon size={20} />
            {tab.label}
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
  return (
    <>
      <TopBar title={title} back={back} />
      <main className={cn("flex-1", bleed ? "" : "px-5 pb-6")}>{children}</main>
      {tab ? <TabBar /> : null}
    </>
  );
}
