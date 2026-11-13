import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

/**
 * FITSYNC design tokens. Colours live in CSS variables (src/app/globals.css) so light and dark themes share one scale.
 *  paper   Warm Ivory #F5F1E8      page background
 *  surface White #FFFFFF           panels, inputs
 *  ink     Deep Charcoal #24251F   text
 *  line    Soft Stone #DDD5C8      hairlines, borders
 *  primary Forest Green #405344    primary actions (white text, 8.3:1)
 *  sage    Muted Sage #A5AD9A      data marks, quiet fills (never text)
 *  accent  Warm Terracotta #B66F52 the "you are here" marker and rare highlights (graphics only; text uses accent-text)
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: v("ink"), paper: v("paper"), surface: v("surface"), line: v("line"), muted: v("muted"),
        primary: v("primary"), "primary-ink": v("primary-ink"), sage: v("sage"),
        accent: v("accent"), "accent-text": v("accent-text"),
        good: v("good"), warn: v("warn"), bad: v("bad"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      fontSize: {
        "2xs": ["0.75rem", { lineHeight: "1.1rem" }],
        xs: ["0.8125rem", { lineHeight: "1.2rem" }],
        sm: ["0.875rem", { lineHeight: "1.35rem" }],
        base: ["1rem", { lineHeight: "1.6rem" }],
        lg: ["1.125rem", { lineHeight: "1.7rem" }],
        xl: ["1.375rem", { lineHeight: "1.9rem" }],
        "d-sm": ["1.75rem", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        "d-md": ["2.5rem", { lineHeight: "1.05", letterSpacing: "-0.015em" }],
        "d-lg": ["3.5rem", { lineHeight: "1", letterSpacing: "-0.02em" }],
        "d-xl": ["5.25rem", { lineHeight: "0.95", letterSpacing: "-0.025em" }],
      },
      borderRadius: { sm: "3px", DEFAULT: "4px", md: "6px" },
      maxWidth: { prose: "38rem" },
      transitionTimingFunction: { out: "cubic-bezier(.2,.7,.2,1)" },
    },
  },
  plugins: [],
} satisfies Config;
