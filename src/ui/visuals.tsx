import { cn } from "./primitives";

export function CityMark({ className = "h-16 w-24 text-gold" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 84" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M20 72V30" />
        <path d="M100 72V30" />
        <circle cx="20" cy="24" r="6" />
        <circle cx="100" cy="24" r="6" />
        <path d="M36 72V48c0-14 48-14 48 0v24" />
        <path d="M50 72V54c0-8 20-8 20 0v18" />
        <path d="M52 40V26" />
        <path d="M68 40V26" />
        <circle cx="52" cy="22" r="4" />
        <circle cx="68" cy="22" r="4" />
        <circle cx="60" cy="36" r="5" />
      </g>
    </svg>
  );
}

export function Portrait({
  name,
  palette,
  className,
  mode = "photo",
  src,
  compact = false,
}: {
  name: string;
  palette: [string, string];
  className?: string;
  mode?: "photo" | "avatar" | "initials";
  src?: string;
  compact?: boolean;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (mode === "initials") {
    return (
      <div className={cn("grid place-items-center bg-card2 font-serif text-4xl text-cream", className)}>
        {initials}
      </div>
    );
  }
  if (src && mode === "photo") {
    return <img src={src} alt="" className={cn("object-cover", className)} />;
  }
  if (mode === "avatar") {
    return (
      <div className={cn("grid place-items-center", className)} style={{ background: palette[0] }}>
        <span
          className="grid h-16 w-16 place-items-center rounded-full font-serif text-2xl"
          style={{ background: palette[1], color: "#160E1F" }}
        >
          {initials}
        </span>
      </div>
    );
  }
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ background: `linear-gradient(165deg, ${palette[0]} 10%, ${palette[1]} 78%, #160E1F)` }}
    >
      <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
      <div className="absolute -left-8 bottom-8 h-24 w-24 rounded-full bg-ink/20" />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-ink via-ink/50 to-transparent" />
      <span
        className={cn(
          "absolute font-serif tracking-tight text-cream",
          compact ? "inset-0 grid place-items-center text-2xl" : "bottom-3 left-4 text-5xl",
        )}
      >
        {initials}
      </span>
    </div>
  );
}

export function MapCard({ name, area }: { name: string; area: string }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-card">
      <svg viewBox="0 0 320 160" className="h-36 w-full" role="img" aria-label={`Map showing ${name}`}>
        <rect width="320" height="160" fill="#241830" />
        <path d="M0 90 H320 M40 0 V160 M180 0 V160 M260 20 H40" stroke="#3A2A48" strokeWidth="8" />
        <path d="M20 120 C 80 80, 140 140, 220 90 S 300 70, 320 100" fill="none" stroke="#9FD7C7" strokeWidth="2" />
        <circle cx="168" cy="78" r="8" fill="#FFB547" />
        <circle cx="168" cy="78" r="16" fill="none" stroke="#FFB547" />
      </svg>
      <div className="px-4 py-3">
        <p className="font-semibold">{name}</p>
        <p className="text-sm text-mute">{area}</p>
      </div>
    </div>
  );
}
