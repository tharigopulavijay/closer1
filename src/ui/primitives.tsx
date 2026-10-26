import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "mint";
};

export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-14 min-h-14 w-full items-center justify-center rounded-2xl px-4 text-base font-bold disabled:opacity-40",
        variant === "primary" && "bg-gold text-ink",
        variant === "ghost" && "border border-line bg-transparent text-cream",
        variant === "danger" && "bg-coral text-ink",
        variant === "mint" && "bg-mint text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function Chip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-4 text-sm font-semibold",
        active ? "border-gold bg-gold text-ink" : "border-line bg-card text-cream",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Headline({
  text,
  italic,
  className,
}: {
  text: string;
  italic: string;
  className?: string;
}) {
  const index = text.indexOf(italic);
  if (index < 0) {
    return <h2 className={cn("font-serif text-5xl leading-[0.95] text-cream", className)}>{text}</h2>;
  }
  return (
    <h2 className={cn("font-serif text-5xl leading-[0.95] text-cream", className)}>
      {text.slice(0, index)}
      <span className="italic text-gold">{italic}</span>
      {text.slice(index + italic.length)}
    </h2>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-3xl border border-line bg-card p-4", className)}>{children}</section>;
}

export function Toggle({
  on,
  label,
  hint,
  onChange,
}: {
  on: boolean;
  label: string;
  hint?: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center gap-4 rounded-3xl border border-line bg-card p-4 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {hint ? <span className="mt-1 block text-sm text-mute">{hint}</span> : null}
      </span>
      <span className={cn("h-7 w-12 shrink-0 rounded-full p-1", on ? "bg-gold" : "bg-line")}>
        <span className={cn("block h-5 w-5 rounded-full bg-ink transition-transform", on && "translate-x-5")} />
      </span>
    </button>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
      <div className="h-full rounded-full bg-gold" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

export function VerifiedPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-mint/15 px-2.5 py-1 text-xs font-semibold text-mint">
      <span className="h-1.5 w-1.5 rounded-full bg-mint" />
      Verified
    </span>
  );
}

export function Sheet({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60">
      <button type="button" aria-label="Close sheet" className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[430px] rounded-t-3xl border border-line bg-card2 p-5 pb-8">
        <h2 className="font-serif text-3xl">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-mute">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "h-14 w-full rounded-2xl border border-line bg-card px-4 text-base text-cream outline-none placeholder:text-mute";
