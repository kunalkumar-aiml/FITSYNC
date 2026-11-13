"use client";
import { motion } from "framer-motion";

export type RulerProps = {
  bodyCm: number;
  dimensionLabel: string;
  sizes: { label: string; cm: number; max?: number }[];
  /** ideal garment measurement band in cm (body + ease range) */
  band: { min: number; max: number };
  recommended?: string | null;
  /** what the size values are: garment measurements or the body a size is made for */
  valueKind?: "garment" | "body";
};

/**
 * The FITSYNC tape: a centimetre scale with your measurement (terracotta), the band that suits the chosen fit,
 * and where each size of the chart sits. Every number on it is real data from the chart.
 */
export function EaseRuler({ bodyCm, dimensionLabel, sizes, band, recommended, valueKind = "garment" }: RulerProps) {
  const all = [bodyCm, band.min, band.max, ...sizes.flatMap((s) => (s.max !== undefined ? [s.cm, s.max] : [s.cm]))];
  const lo = Math.floor(Math.min(...all) - 4);
  const hi = Math.ceil(Math.max(...all) + 4);
  const W = 680, pad = 20, y = 64;
  const x = (cm: number) => pad + ((cm - lo) / (hi - lo)) * (W - pad * 2);
  const ticks = [];
  for (let c = lo; c <= hi; c++) ticks.push(c);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} 132`} className="w-full h-auto" role="img"
        aria-label={`${dimensionLabel}: you measure ${bodyCm} cm. For this fit, a ${valueKind === "garment" ? "garment" : "size"} of ${band.min.toFixed(0)} to ${band.max.toFixed(0)} cm suits you. Sizes: ${sizes.map((s) => `${s.label} ${s.cm} cm`).join(", ")}.`}>
        <rect x={pad - 8} y={y - 2} width={W - pad * 2 + 16} height={30} rx={2} fill="rgb(var(--surface))" stroke="rgb(var(--line))" />
        {ticks.map((c) => (
          <line key={c} x1={x(c)} x2={x(c)} y1={y - 2} y2={y - 2 + (c % 10 === 0 ? 14 : c % 5 === 0 ? 9 : 5)} stroke="rgb(var(--muted))" strokeOpacity={c % 5 === 0 ? 0.8 : 0.4} strokeWidth="1" />
        ))}
        {ticks.filter((c) => c % 10 === 0).map((c) => (
          <text key={`l${c}`} x={x(c) + 3} y={y + 21} fontSize="9" fill="rgb(var(--muted))" className="num">{c}</text>
        ))}
        <motion.rect initial={false} animate={{ x: x(band.min), width: Math.max(2, x(band.max) - x(band.min)) }}
          transition={{ type: "spring", stiffness: 240, damping: 30 }}
          y={y - 2} height={30} fill="rgb(var(--sage) / 0.35)" />
        {x(band.max) - x(band.min) > 70 && <text x={(x(band.min) + x(band.max)) / 2} y={y - 10} textAnchor="middle" fontSize="11" fill="rgb(var(--muted))">suits this fit</text>}
        {sizes.map((s, i) => {
          const on = s.label === recommended;
          const stroke = on ? "rgb(var(--ink))" : "rgb(var(--muted))";
          if (s.max !== undefined) {
            // A published range: drawn as a span, alternating rows so neighbouring spans never overlap.
            const yy = y + 36 + (i % 2) * 8;
            return (
              <g key={s.label}>
                <line x1={x(s.cm) + 1} x2={x(s.max) - 1} y1={yy} y2={yy} stroke={stroke} strokeWidth={on ? 3 : 1.5} />
                <text x={(x(s.cm) + x(s.max)) / 2} y={y + 64} textAnchor="middle" fontSize="13" fontWeight={on ? 650 : 450} fill={stroke}>{s.label}</text>
              </g>
            );
          }
          return (
            <g key={s.label}>
              <line x1={x(s.cm)} x2={x(s.cm)} y1={y + 28} y2={y + 40} stroke={stroke} strokeWidth={on ? 2.5 : 1.2} />
              <text x={x(s.cm)} y={y + 56} textAnchor="middle" fontSize="14" fontWeight={on ? 650 : 450} fill={stroke}>{s.label}</text>
              <text x={x(s.cm)} y={y + 68} textAnchor="middle" fontSize="9.5" fill="rgb(var(--muted))" className="num">{s.cm}</text>
            </g>
          );
        })}
        <motion.g initial={false} animate={{ x: x(bodyCm) }} transition={{ type: "spring", stiffness: 260, damping: 28 }}>
          <line x1={0} x2={0} y1={y - 30} y2={y + 28} stroke="rgb(var(--accent))" strokeWidth="2" />
          <circle cx={0} cy={y - 32} r="4" fill="rgb(var(--accent))" />
          <text x={6} y={y - 38} fontSize="11.5" fontWeight="600" fill="rgb(var(--ink))" className="num">You, {bodyCm} cm</text>
        </motion.g>
      </svg>
      <figcaption className="sr-only">Measurement scale for {dimensionLabel}</figcaption>
    </figure>
  );
}
