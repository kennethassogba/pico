import { z } from 'zod';

export const viewTypes = ['dashboard', 'checklist', 'form', 'pricing', 'comparison', 'itinerary'] as const;
export const accents = ['violet', 'blue', 'rose', 'orange'] as const;
export const viewSchema = z.enum(viewTypes);
export type ViewType = z.infer<typeof viewSchema>;
export const contentSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(240),
  labels: z.array(z.string().max(48)).min(2).max(4),
  items: z.array(z.object({
    name: z.string().min(1).max(100),
    detail: z.string().max(200),
    value: z.string().max(60),
  })).min(2).max(6),
  metrics: z.array(z.object({ label: z.string().max(48), value: z.string().max(48) })).min(2).max(4),
});
export type Content = z.infer<typeof contentSchema>;
export type Plan = { view: ViewType; accent: typeof accents[number]; confidence: number; decisionMs: number; model: string };
export type Result = { plan: Plan; content: Content; generationModel: string; totalMs: number };
export const requestSchema = z.object({
  prompt: z.string().trim().min(3).max(1200),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(1600) })).max(6).default([]),
  previous: z.object({ view: viewSchema, content: contentSchema }).optional(),
}).strict();

export const viewNames: Record<ViewType, string> = {
  dashboard: 'Dashboard', checklist: 'Checklist', form: 'Form', pricing: 'Pricing', comparison: 'Comparison', itinerary: 'Itinerary',
};
