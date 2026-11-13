# Recommendation engine (`src/lib/engine`)

Pure, deterministic TypeScript; the same code runs on the server and in the landing-page demo.

1. **Validate** body measurements against plausible adult ranges (catches unit mistakes).
2. **Pick a chart** (`lib/chart-select.ts`): never mixes men’s and women’s; a product’s chart only for that product; evidence order VERIFIED product > VERIFIED brand > UNVERIFIED product > UNVERIFIED brand; region and cut preferences after that. Only VERIFIED and UNVERIFIED versions are eligible.
3. **Resolve meaning per dimension** (`semantics.ts`): explicit per-dimension semantics > ambiguous flag > chart-level type (BODY/GARMENT). UNKNOWN or MIXED chart types never default to GARMENT. Flat widths are never compared.
4. **Score each size**: GARMENT values are compared with *body + ease* for the chosen fit; BODY values with a small offset (the brand already built ease in). Ranges count as perfect inside the range. Tight is penalised 1.25× more than loose.
5. **Answer**: `ok` (size, alternatives, per-dimension labels, achieved fit when the primary value is a garment measurement, explanation, warnings), `no_compatible_size`, `insufficient_data` (with the reason: missing body measurement, ambiguous or flat-width chart dimension, chart awaiting review), or `invalid_input`.

**Fit Match Score** (0–1, shown as 0–100) is experimental: best score × coverage × margin over the runner-up, capped at 0.55 for unverified charts. It is not a probability and has not been validated.

**Ease allowances** live in `config.ts` per category and fit preference. They are pattern-making starting points, **not validated**. Calibrate them from Admin → Feedback analytics once groups have enough reports (aim for dozens per brand/category, not a handful), change `config.ts`, and keep the test suite green.

**Garment cut** (how the brand cuts it, possibly UNKNOWN) is distinct from **fit preference** (what the shopper wants) and **achieved fit** (what the size should feel like).
