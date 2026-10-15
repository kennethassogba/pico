import { bindings, defineConfig, triggers } from 'cf/config';

export default defineConfig({
  accountId: '05838fc24a89cefaf6081066cca13544',
  worker: {
    name: 'pico-keff',
    entrypoint: './worker/index.ts',
    compatibilityDate: '2026-10-15',
    assets: { runWorkerFirst: true, htmlHandling: 'none', notFoundHandling: 'single-page-application' },
    env: {
      ASSETS: bindings.assets(),
      OPENROUTER_API_KEY: bindings.secret(),
      REQUEST_LIMITER: bindings.rateLimit({ namespace: '26101501', simple: { limit: 6, period: 60 } }),
      GLOBAL_LIMITER: bindings.rateLimit({ namespace: '26101502', simple: { limit: 18, period: 60 } }),
    },
    triggers: [
      triggers.fetch({ pattern: 'keff.uk/pico', zone: 'keff.uk' }),
      triggers.fetch({ pattern: 'keff.uk/pico/*', zone: 'keff.uk' }),
    ],
    workersDev: true,
    observability: { enabled: true, redactQueryString: true, traces: { enabled: true, headSamplingRate: 0.1 } },
  },
});
