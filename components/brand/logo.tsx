import { cn } from "@/lib/utils";

/** Isotipo: una mira (hunting) dentro de un cuadrado con degradé índigo → cian. */
export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-heading font-bold", className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-8 shrink-0">
        <defs>
          <linearGradient id="ah-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4f46e5" />
            <stop offset="1" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="url(#ah-grad)" />
        <circle cx="16" cy="16" r="7.5" fill="none" stroke="#fff" strokeWidth="2.2" />
        <circle cx="16" cy="16" r="2.4" fill="#fff" />
        <path d="M16 4.5v5M16 22.5v5M4.5 16h5M22.5 16h5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      {withText && (
        <span className="text-lg tracking-tight">
          <span className="bg-gradient-to-br from-[#4f46e5] to-[#06b6d4] bg-clip-text text-transparent">AI</span>-Hunting
        </span>
      )}
    </span>
  );
}
