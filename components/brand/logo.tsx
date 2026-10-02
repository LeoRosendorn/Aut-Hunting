import { cn } from "@/lib/utils";

/**
 * Isotipo: una mira (hunting) sobre un cuadrado azul marino (teal en modo oscuro).
 * El fondo va en CSS y no dentro del SVG: con dos logos en la página y uno oculto
 * (display:none), un id de <linearGradient> compartido dejaba al visible sin relleno.
 */
export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-heading font-bold whitespace-nowrap", className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-navy dark:bg-primary">
        <svg viewBox="0 0 32 32" aria-hidden="true" className="size-8">
          <circle cx="16" cy="16" r="7.5" fill="none" stroke="#fff" strokeWidth="2.2" />
          <circle cx="16" cy="16" r="2.4" fill="#fff" />
          <path d="M16 4.5v5M16 22.5v5M4.5 16h5M22.5 16h5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
      {withText && (
        <span className="text-lg tracking-tight">
          <span className="text-primary">AI</span>-Hunting
        </span>
      )}
    </span>
  );
}
