# Generated interface color review

Scope: dark generated views, four selectable accent themes, data charts, tasks, forms, pricing, comparison and itinerary. The chat shell remains neutral. No light theme is shipped.

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| LOW | `src/palette.css`, `scripts/build-palette.mjs` | Default generated views inherited neutral emphasis | Four constant-hue OKLCH ramps, emitted as gamut-clamped sRGB hex and mapped to surface, border, chart, fill and text roles | Every consumed step has a role; components use semantic tokens |
| LOW | `src/styles.css` | Secondary text `#a3a3a3` | `#b3b3b3` | Measured secondary label contrast improved, including APCA legibility on the actual card surface |

No actionable color findings remain in the inspected states.

Verification: 860 rendered foreground/background pairs, including all four themes on each of the six view types at 1280 × 800, 390 × 844 and 320 × 568, plus the bar-chart variant. Backgrounds are computed from the actual ancestor surface stack; text is never placed over the photographs. WCAG 2 contrast is computed from rendered sRGB values; APCA uses `apca-w3`. Output is saved in ignored `output/playwright/colors.json` and `colors-bars.json`.

| Theme | Minimum text ratio | Minimum meaningful graphic ratio | Minimum text APCA magnitude |
| --- | --- | --- | --- |
| Violet | 9.01:1 | 5.21:1 | 60.71 |
| Blue | 9.01:1 | 5.50:1 | 60.71 |
| Rose | 9.01:1 | 5.12:1 | 60.71 |
| Orange | 9.01:1 | 5.36:1 | 60.71 |

Inspected text passes the applicable WCAG 2 thresholds (4.5:1 normal text; 3:1 large text); inspected meaningful graphics pass 3:1. Color is paired with labels, icons, selected states or values. Motion obeys reduced-motion preferences. These results cover the inspected fixtures and rendered roles, not a claim of full WCAG conformance.

Not verified: physical display color calibration, forced-colors rendering and transient animation-frame contrast. Palette primitives are generated in gamut rather than relying on wide-gamut display support.

Approve.
