import { cn } from "../lib/utils";
import { Link } from "react-router-dom";

/**
 * EditorialMetric — Apple-refined: precision sans display number + small-caps label + hairline.
 * Shadow-less by default (used in lightweight metric grids) — wrap in Surface for elevation.
 */
export function EditorialMetric({ label, value, sublabel, accent, accentLink, size = "lg", testId, className }) {
  const sizes = {
    sm: "text-2xl lg:text-3xl",
    md: "text-3xl lg:text-4xl",
    lg: "text-4xl lg:text-5xl",
    xl: "text-5xl lg:text-6xl xl:text-7xl",
  };
  return (
    <div className={cn("flex flex-col gap-2.5", className)} data-testid={testId}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="smallcaps text-ink-600">{label}</span>
        {accent && (
          accentLink ? (
            <Link to={accentLink} className="smallcaps font-mono hover:underline" style={{ color: accent.color || "#52504A" }}>
              {accent.text}
            </Link>
          ) : (
            <span className="smallcaps font-mono" style={{ color: accent.color || "#52504A" }}>
              {accent.text}
            </span>
          )
        )}
      </div>
      <div className="hairline-soft" />
      <p className={cn("ticking-num text-ink-900", sizes[size])}>{value}</p>
      {sublabel && <p className="text-xs text-ink-500 font-display-text">{sublabel}</p>}
    </div>
  );
}

/**
 * SectionHeader — Apple-grade hero: massive Inter Tight display + serif italic accent word
 * for selective editorial flourish. Tightened spacing for denser layouts.
 */
export function SectionHeader({ overline, title, lead, right }) {
  return (
    <header className="mb-7 lg:mb-10">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div className="max-w-3xl">
          {overline && <p className="smallcaps mb-2.5">{overline}</p>}
          <h1 className="font-display text-4xl lg:text-5xl xl:text-6xl text-ink-900 leading-[0.96]">
            {title}
          </h1>
          {lead && <p className="mt-4 text-sm lg:text-base text-ink-500 max-w-2xl leading-relaxed">{lead}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div className="hairline mt-6" />
    </header>
  );
}

/**
 * Surface — Apple-style elevated card with layered soft shadow + subtle 20px radius.
 */
export function Surface({ children, className, padding = "p-6 lg:p-8", hover = false, testId, ...rest }) {
  return (
    <div
      className={cn(
        "surface-apple",
        hover && "surface-apple-hover",
        padding,
        className,
      )}
      data-testid={testId || rest["data-testid"]}
      {...Object.fromEntries(Object.entries(rest).filter(([k]) => k !== "data-testid"))}
    >
      {children}
    </div>
  );
}

/**
 * Inline metadata row
 */
export function MetaRow({ items, className }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-600", className)}>
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          <span className="smallcaps text-ink-400">{it.label}</span>
          <span className="font-medium text-ink-900">{it.value}</span>
        </span>
      ))}
    </div>
  );
}

export default EditorialMetric;
