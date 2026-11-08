"use client";
import { motion } from "framer-motion";

export type RulerProps = {
  bodyCm: number;
  dimensionLabel: string;
  sizes: { label: string; cm: number }[];
  /** ideal garment measurement band in cm (body + ease range) */
  band: { min: number; max: number };
  recommended?: string | null;
};

/** Number line in cm: your body, the ideal garment band for the chosen fit, and where each size lands. */
export function EaseRuler({ bodyCm, dimensionLabel, sizes, band, recommended }: RulerProps) {
  const all = [bodyCm, band.min, band.max, ...sizes.map((s) => s.cm)];
  const lo = Math.floor(Math.min(...all) - 4);
  const hi = Math.ceil(Math.max(...all) + 4);
  const W = 640, pad = 28, y = 70;
  const x = (cm: number) => pad + ((cm - lo) / (hi - lo)) * (W - pad * 2);
  return (
    <svg viewBox={`0 0 ${W} 130`} className="w-full h-auto" role="img"
      aria-label={`${dimensionLabel}: your body is ${bodyCm} cm. Ideal garment measurement is ${band.min.toFixed(0)} to ${band.max.toFixed(0)} cm.`}>
      <line x1={pad} x2={W - pad} y1={y} y2={y} stroke="rgb(var(--line))" strokeWidth="2" strokeLinecap="round" />
      <motion.rect initial={false} animate={{ x: x(band.min), width: Math.max(2, x(band.max) - x(band.min)) }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        y={y - 14} height={28} rx={14} fill="rgb(var(--accent) / 0.28)" stroke="rgb(var(--accent))" strokeWidth="1.5" />
      <text x={(x(band.min) + x(band.max)) / 2} y={y - 24} textAnchor="middle" fontSize="11" fill="rgb(var(--muted))">ideal for this fit</text>
      {sizes.map((s) => {
        const on = s.label === recommended;
        return (
          <g key={s.label}>
            <line x1={x(s.cm)} x2={x(s.cm)} y1={y - 10} y2={y + 10} stroke={on ? "rgb(var(--ink))" : "rgb(var(--muted))"} strokeWidth={on ? 3 : 1.5} />
            <text x={x(s.cm)} y={y + 30} textAnchor="middle" fontSize="13" fontWeight={on ? 700 : 500} fill={on ? "rgb(var(--ink))" : "rgb(var(--muted))"}>{s.label}</text>
            <text x={x(s.cm)} y={y + 45} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))">{s.cm}</text>
          </g>
        );
      })}
      <g>
        <line x1={x(bodyCm)} x2={x(bodyCm)} y1={y - 44} y2={y + 14} stroke="rgb(var(--ink))" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx={x(bodyCm)} cy={y} r="5" fill="rgb(var(--ink))" />
        <text x={x(bodyCm)} y={y - 50} textAnchor="middle" fontSize="12" fontWeight="600" fill="rgb(var(--ink))">you · {bodyCm} cm</text>
      </g>
    </svg>
  );
}
