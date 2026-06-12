import { cn } from "../lib/utils";
import { useBranding, absoluteBrandUrl } from "../lib/branding";

/**
 * Logo — renders the property's uploaded logo when present, falling back
 * to a tasteful typographic wordmark made from the configured hotel name.
 *
 * - `mono` renders the wordmark only (used in tight corners)
 * - `variant="dark"` switches the wordmark colour for dark mobile theme
 */
export function Logo({ size = "md", variant = "light", className, mono = false }) {
  const brand = useBranding();
  const heights = { xs: "h-5", sm: "h-7", md: "h-8", lg: "h-12", xl: "h-16" };
  const logoUrl = absoluteBrandUrl(brand.logo_url);
  const name = brand.hotel_name || "SpotyTags";

  // Word-mark: pick the first 5 chars as the "house" + last word as the accent
  const parts = name.split(" ");
  let head = name;
  let tail = "";
  if (parts.length > 1) {
    head = parts.slice(0, -1).join(" ");
    tail = parts[parts.length - 1];
  } else if (name.length > 4) {
    head = name.slice(0, Math.ceil(name.length / 2));
    tail = name.slice(Math.ceil(name.length / 2));
  }

  // Wordmark variant — pure typography brand mark
  if (mono || !logoUrl) {
    const headTone = variant === "dark" ? "text-cream" : "text-ink-900";
    return (
      <span
        className={cn(
          "font-display font-medium tracking-display-tight inline-flex items-baseline gap-0",
          className,
        )}
        data-testid="brand-wordmark"
        title={name}
      >
        <span className={headTone}>{head}</span>
        {tail && <span className="text-brand">{tail}</span>}
      </span>
    );
  }
  return (
    <img
      src={logoUrl}
      alt={name}
      className={cn(heights[size], "w-auto select-none", className)}
      draggable={false}
      data-testid="brand-logo"
    />
  );
}

export default Logo;
