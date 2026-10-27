import { Link } from "react-router-dom";
import { useStore } from "../../state/store";
import { Screen } from "../../ui/shell";
import { POLICY_PAGES } from "./pages";

export function PolicyLinks({ className = "" }: { className?: string }) {
  return (
    <nav className={`flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-mute ${className}`} aria-label="Policies">
      {POLICY_PAGES.map((page) => (
        <Link key={page.path} to={page.path} className="inline-flex min-h-11 items-center underline decoration-line underline-offset-4">
          {page.label}
        </Link>
      ))}
    </nav>
  );
}

export function PolicyPage({ path }: { path: string }) {
  const { state } = useStore();
  const page = POLICY_PAGES.find((item) => item.path === path);
  if (!page) return null;
  return (
    <Screen title={page.title} back={state.ready ? "/you/settings" : "/"}>
      <div className="space-y-4 text-sm leading-6 text-mute">
        {page.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </Screen>
  );
}

export function Privacy() {
  return <PolicyPage path="/privacy" />;
}

export function Terms() {
  return <PolicyPage path="/terms" />;
}

export function Refunds() {
  return <PolicyPage path="/refunds" />;
}

export function Contact() {
  return <PolicyPage path="/contact" />;
}

export function SafetyPolicy() {
  return <PolicyPage path="/safety-policy" />;
}
