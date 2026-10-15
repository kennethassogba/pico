# Pico interface review

Scope: the complete prompt-to-preview flow, six generated layouts, local controls, failure recovery, chat history and the technical details dialog. React, Tailwind 4, official shadcn component sources, Geist and a dark neutral palette. The user’s explicit minimal ChatGPT/Vercel direction takes precedence over their usual light-interface default. Project conventions come from the supplied AGENTS.md instructions; no additional project convention documents existed before implementation.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | `src/App.tsx`, `src/Preview.tsx`, focus rules in `src/styles.css`; axe audits of empty and populated states at 1280, 390 and 320 px; form labels, checkbox names, dialog Escape and focus restoration | Clear in inspected states |
| Layout | Single viewport shell, VisualViewport resize handling, height-aware preview pagination; 18 view/viewport cases in `scripts/check-interface.mjs` | No page or horizontal preview overflow; standard fixture content fits without scrolling |
| Writing | All product strings in `src/App.tsx` and `src/Preview.tsx`; API errors in `worker/index.ts` | Decorative slogans removed; errors offer recovery; model and privacy information confined to the details window |
| Typography | Geist variable font, larger heading and input sizes, unitless line heights, 16 px minimum inputs, tabular numeric values | Clear |
| Colors | Dark semantic tokens in `src/styles.css`; rendered contrast evaluated by axe across all six layouts | Clear; no green or lime palette |
| UI | Native dialogs, shadcn controls, muted skeletons specific to each chosen layout, reduced-motion rules, local selection states | Clear |

No actionable interface findings remain in the inspected states.

Verification: `npm run check`; `npm test` (15 API, provider and discovery contract tests); `npm run test:ui` (18 layout/viewport combinations, empty states, axe audits, local interactions, error recovery, dialog Escape/focus restoration). The UI script uses explicit provider fixtures. Separate live OpenRouter calls verified Mercury selection and free-router generation; fixture timing is not a live latency benchmark. Screenshots and machine-readable results are written to the ignored `output/playwright` directory.

Not verified: a physical iOS/Android keyboard, a screen reader, and browser-level 200% zoom. The preview panel and dialogs retain scrolling as an accessibility fallback for exceptionally long generated content or enlarged text. This review is not a claim of complete WCAG conformance.

Verdict: Approve for the inspected domains and states.
