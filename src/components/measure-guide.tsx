/**
 * Original line drawing of a figure, front view, with the path of each measurement highlighted.
 * Used in the fit-profile flow so people can see where the tape goes.
 */
export type GuideKey = "heightCm" | "weightKg" | "chestCm" | "waistCm" | "hipsCm" | "shoulderCm" | "armLengthCm" | "inseamCm" | "neckCm" | "thighCm";

const PATHS: Partial<Record<GuideKey, React.ReactNode>> = {
  chestCm: <ellipse cx="100" cy="120" rx="40" ry="6" />,
  waistCm: <ellipse cx="100" cy="160" rx="32" ry="5" />,
  hipsCm: <ellipse cx="100" cy="198" rx="43" ry="6" />,
  neckCm: <ellipse cx="100" cy="66" rx="9" ry="3" />,
  thighCm: <ellipse cx="82" cy="238" rx="17" ry="4" />,
  shoulderCm: <path d="M61 89 Q100 80 139 89" />,
  armLengthCm: <path d="M139 90 Q152 118 158 150 Q162 180 165 206" />,
  inseamCm: <path d="M100 222 Q98 260 97 300 Q97 340 98 376" />,
  heightCm: <path d="M184 22 L184 378 M178 22 h12 M178 378 h12" />,
};

export function MeasureGuide({ active }: { active: GuideKey | null }) {
  return (
    <svg viewBox="0 0 200 400" className="w-full h-auto max-h-[26rem]" role="img" aria-label={active ? "Where to measure, highlighted on a figure" : "Figure showing where to measure"}>
      <g fill="none" stroke="rgb(var(--ink))" strokeOpacity="0.55" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
        <circle cx="100" cy="40" r="18" />
        {[1, -1].map((side) => (
          <g key={side} transform={side === -1 ? "translate(200 0) scale(-1 1)" : undefined}>
            <path d="M93 57 L93 72 Q78 80 61 89 Q60 100 62 112 Q66 138 69 160 Q60 182 58 198 Q60 208 64 216 Q70 260 75 300 Q80 340 84 376 L98 378 Q98 340 97 300 Q98 260 100 220" />
            <path d="M61 89 Q48 118 42 150 Q38 180 35 206 M62 112 Q54 132 50 152 Q46 180 43 206 M35 206 Q38 214 43 206" />
          </g>
        ))}
      </g>
      {active && PATHS[active] && (
        <g fill="none" stroke="rgb(var(--accent))" strokeWidth="2.6" strokeLinecap="round" strokeDasharray={active === "heightCm" ? undefined : "5 3"}>{PATHS[active]}</g>
      )}
    </svg>
  );
}
