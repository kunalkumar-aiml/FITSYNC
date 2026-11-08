import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: v("ink"), paper: v("paper"), surface: v("surface"), line: v("line"),
        muted: v("muted"), accent: v("accent"), "accent-ink": v("accent-ink"),
        good: v("good"), warn: v("warn"), bad: v("bad"),
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', '"SF Pro Text"', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'sans-serif'],
      },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: { card: "0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(0 0 0 / 0.12)" },
    },
  },
  plugins: [],
} satisfies Config;
