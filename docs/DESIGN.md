# Design system

**Character:** an editorial fashion house that happens to measure things precisely. Warm paper, charcoal type, a single
forest-green action colour, and one memorable device: **the tape** (a centimetre scale with your terracotta marker), used in
the landing demo and in every result. Everything around it stays quiet.

## Tokens (`tailwind.config.ts`, `src/app/globals.css`)
| Token | Light | Use |
|---|---|---|
| paper | Warm Ivory #F5F1E8 | page |
| surface | White #FFFFFF | panels, inputs |
| ink | Deep Charcoal #24251F | text (13.7:1 on paper) |
| muted | #5D5F55 | secondary text (5.8:1) |
| line | Soft Stone #DDD5C8 | hairlines, borders |
| primary | Forest Green #405344 | primary actions, white text (8.3:1) |
| sage | Muted Sage #A5AD9A | data marks and bands only, never text |
| accent | Warm Terracotta #B66F52 | the “you” marker and step numbers; graphics only (3.5:1) |
| accent-text | #9A5A40 | terracotta for text (4.8:1) |

Dark theme mirrors the scale (charcoal paper, ivory ink, sage as the primary action).

## Type
Instrument Serif (display: page titles, sizes, brand names) and Instrument Sans variable (everything else), both
self-hosted under the SIL OFL in `src/app/fonts`. Numbers in tables and measurements use tabular figures. Display sizes:
1.75 / 2.5 / 3.5 / 5.25 rem.

## Principles
- Structure with whitespace and hairline rules; panels only where content is a distinct object (forms, figures, dialogs).
- Radius: 3–6 px. No glassmorphism, gradients, neon or emoji. No brand logos, ever; brand names are set in type.
- Motion: one orchestrated hero entrance, a quiet page cross-fade, and motion that answers actions (tape marker,
  step changes, toasts). Everything honours “reduce motion”.
- Copy: plain verbs, sentence case, no fake statistics, no urgency tricks. Errors say what happened and what to do.
