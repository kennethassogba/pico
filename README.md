# Pico

A minimal chat that turns requests into interactive shadcn interfaces. [Open Pico](https://keff.uk/pico).

The interface uses Geist, dark shadcn components and a single centered composer. Technical metadata and JSON export live in the details dialog.

`inception/mercury-decide:free` chooses one of six prebuilt layouts through OpenRouter’s typed Decisions API. The layout renders as soon as that decision arrives. `openrouter/free` fills its content over a stream. The interface displays measured layout and completion times. Every upstream model is free; the server accepts no model overrides.

The catalog includes a dashboard, checklist, form, pricing view, comparison table and itinerary. Checkboxes, task additions, form entries and plan selection work locally. Follow-up prompts refine the current preview. JSON export downloads the content and selected layout; it is not an application source export.

## Development

Use Node.js 24. Run `npm ci`, add `OPENROUTER_API_KEY` to the ignored `.dev.vars` file, then run `npm run dev`. Open `http://127.0.0.1:5174/pico/`.

Run `npm run check`, `npm test` and `npm run test:ui` with the dev server running. The interface checks use explicit mocked provider events; they do not establish live model performance. Run `npx cf deploy --dry-run` to validate the production bundle.

## Agents and link previews

Connect an MCP client to `https://keff.uk/pico/mcp` using Streamable HTTP. Cloudflare's Agents SDK provides the stateless transport, with MCP SDK v2 and legacy client compatibility. `list_components` returns the available layouts; `generate_interface` calls the same real generation pipeline and rate limiters as the browser. It returns validated interface data, never executable code. The endpoint is public and needs no user credential. It cannot read another browser's preview or conversation.

Pico follows the applicable [Cloudflare Agent Readiness conventions](https://blog.cloudflare.com/agent-readiness/): Markdown negotiation (`Accept: text/markdown`), `/index.md`, Link discovery headers, an RFC 9727 API catalog, OpenAPI, a draft MCP server card and an Agent Skills document. These resources live under `/pico` and are advertised in its response headers; origin-root discovery remains owned by the portfolio. No OAuth or commerce support is advertised. This is not a claim of a scanner score or support for every emerging standard.

- [Agent guide](https://keff.uk/pico/index.md)
- [API catalog](https://keff.uk/pico/.well-known/api-catalog)
- [MCP server card](https://keff.uk/pico/.well-known/mcp/server-card.json)
- [OpenAPI](https://keff.uk/pico/openapi.json)

Run `node scripts/check-agents.mjs` against the local Worker, or set `PICO_URL=https://keff.uk/pico` for production. It uses a real MCP client to initialize, discover and call the catalog tool, and checks validation and origin/body limits without consuming model capacity.

Static Open Graph and Twitter metadata reference a 1200 × 630 PNG of the real interface. Social crawlers can retrieve the image without running JavaScript. Network-specific preview caches may take time to refresh.

## Deployment

GitHub Actions verifies each push to `main`, then deploys the Cloudflare Worker `pico-keff`. Add `CLOUDFLARE_API_TOKEN` as a repository Actions secret. It needs Workers Scripts edit on the configured account, Workers Routes edit and Zone read on `keff.uk`, plus Account Settings read for CLI account discovery. The token belongs only in encrypted GitHub secrets.

The OpenRouter key belongs in the Worker’s encrypted `OPENROUTER_API_KEY` secret. It is separate from the deployment token and is never needed by GitHub builds. For the first deployment, use `npx cf deploy --secrets-file /path/to/restricted-secrets.env`; subsequent CI deployments preserve existing Worker secrets. The exact `/pico` and `/pico/*` routes leave the portfolio and other paths untouched.

## Data and limits

Prompts, up to three recent exchanges and the current preview are sent to OpenRouter and its selected provider. Pico has no conversation database, browser storage, analytics SDK or prompt logging. Closing or reloading the tab clears the preview. Cloudflare request logs and provider processing policies still apply.

Generated content is illustrative. Forms do not send or save entries, pricing selections do not purchase anything, and dashboards do not connect to live data. Output is validated against a bounded schema and rendered as React text. Generated HTML and JavaScript are never executed.

The public endpoint limits requests to six per IP and eighteen aggregate requests per minute per Cloudflare location. These are abuse controls, not a global daily quota. OpenRouter’s free capacity and account limits can still interrupt service. Provider errors preserve the previous preview and offer a retry. No paid fallback is configured.

The app uses a single viewport with a bottom composer on mobile. Preview pages keep normal content compact. Exceptionally long content, enlarged text and the JSON view can scroll within their panel so content remains reachable.

API references: [Decisions](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request), [free router](https://openrouter.ai/docs/guides/routing/routers/free-router), [Cloudflare CLI](https://developers.cloudflare.com/cf/projects/cloudflare-config/).
