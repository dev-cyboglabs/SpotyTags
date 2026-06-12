/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
    theme: {
        extend: {
            borderRadius: {
                lg: "16px",
                md: "12px",
                sm: "8px",
                DEFAULT: "12px",
                "apple-sm": "8px",
                "apple": "12px",
                "apple-lg": "20px",
                "apple-xl": "28px",
                "apple-2xl": "36px",
            },
            fontFamily: {
                // Apple-style precision sans (SF Pro Display + SF Pro Text fallback via Inter)
                sans: [
                    '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"',
                    '"Inter"', '"Inter Tight"', '"Helvetica Neue"', 'Arial', 'sans-serif',
                ],
                display: [
                    '"SF Pro Display"', '-apple-system', 'BlinkMacSystemFont',
                    '"Inter Tight"', '"Inter"', '"Helvetica Neue"', 'Arial', 'sans-serif',
                ],
                // Serif kept for selective italic accent flourishes only
                serif: ['"New York"', '"Charter"', 'Georgia', 'ui-serif', 'serif'],
                mono: ['"SF Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
            },
            letterSpacing: {
                "smallcaps": "0.16em",
                "display-tight": "-0.035em",
                "display-tighter": "-0.045em",
                "tighter-apple": "-0.022em",
            },
            colors: {
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                ink: "#1A1A1A",
                cream: "#FAF8F3",
                "cream-deep": "#F2EEE6",
                espresso: "#3E2723",
                oxblood: "#8B2424",
                brand: {
                    DEFAULT: "var(--brand-accent)",
                    50:  "var(--brand-accent)",
                    100: "var(--brand-accent)",
                    200: "var(--brand-accent)",
                    300: "var(--brand-accent)",
                    400: "var(--brand-accent)",
                    500: "var(--brand-accent)",
                    600: "var(--brand-accent)",
                    700: "var(--brand-accent)",
                    muted: "var(--brand-accent)",
                },
                hairline: "#E2DDD0",
                "hairline-soft": "#EEEAE0",
                "ink-50":  "#FAF8F3",
                "ink-100": "#F2EEE6",
                "ink-200": "#E2DDD0",
                "ink-300": "#C8C1B0",
                "ink-400": "#8E887D",
                "ink-500": "#6F6A60",
                "ink-600": "#52504A",
                "ink-700": "#36342F",
                "ink-900": "#1A1A1A",
                status: {
                    success: "#1F7A3D",
                    warning: "#B8860B",
                    danger: "#8B2424",
                    offline: "#8E887D",
                },
                chart: {
                    1: "#1A1A1A",
                    2: "#FF7E6B",
                    3: "#3E2723",
                    4: "#B8860B",
                    5: "#1F7A3D",
                },
            },
            boxShadow: {
                // Apple-quality layered shadows — soft, multi-layer, low opacity
                "apple-sm": "0 1px 2px rgba(15, 13, 8, 0.04), 0 1px 3px rgba(15, 13, 8, 0.03)",
                "apple": "0 1px 2px rgba(15, 13, 8, 0.05), 0 4px 14px rgba(15, 13, 8, 0.05), 0 12px 28px rgba(15, 13, 8, 0.04)",
                "apple-lg": "0 1px 3px rgba(15, 13, 8, 0.05), 0 8px 24px rgba(15, 13, 8, 0.07), 0 24px 60px rgba(15, 13, 8, 0.08)",
                "apple-xl": "0 2px 4px rgba(15, 13, 8, 0.06), 0 12px 32px rgba(15, 13, 8, 0.08), 0 32px 80px rgba(15, 13, 8, 0.10)",
                "apple-brand": "0 1px 2px rgba(255, 126, 107, 0.25), 0 8px 24px rgba(255, 126, 107, 0.18), 0 16px 40px rgba(255, 126, 107, 0.12)",
                "apple-inner": "inset 0 1px 0 rgba(255, 255, 255, 0.6), inset 0 -1px 0 rgba(15, 13, 8, 0.04)",
                "ring-soft": "0 0 0 4px rgba(255, 126, 107, 0.15)",
            },
            backdropBlur: {
                xs: "4px",
                xl: "24px",
                "2xl": "40px",
            },
            keyframes: {
                "fade-in": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
                "fade-up": { from: { opacity: "0", transform: "translateY(20px)" }, to: { opacity: "1", transform: "translateY(0)" } },
                "scale-in": { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
                "shimmer": { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
            },
            animation: {
                "fade-in": "fade-in 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
                "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
                "scale-in": "scale-in 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
                "shimmer": "shimmer 2s linear infinite",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};
