import { z } from 'zod';
import { MAX_ITEMS } from './protocol';

export const viewTypes = ['dashboard', 'checklist', 'form', 'pricing', 'comparison', 'itinerary', 'board', 'gallery', 'calendar', 'calculator', 'accordion', 'timer'] as const;
export const variants = ['standard', 'compact', 'split'] as const;
export const accents = ['violet', 'blue', 'rose', 'orange', 'cyan', 'amber'] as const;
export const visuals = ['area', 'bars', 'kyoto', 'coffee', 'desert', 'santorini', 'mountains', 'architecture', 'vinyl', 'concrete', 'ceramics', 'type', 'none'] as const;
export const viewSchema = z.enum(viewTypes);
export type ViewType = z.infer<typeof viewSchema>;
export const contentSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(240),
  labels: z.array(z.string().max(48)).min(2).max(4),
  items: z.array(z.object({
    image: z.enum(['kyoto', 'coffee', 'desert', 'santorini', 'mountains', 'architecture', 'vinyl', 'concrete', 'ceramics']).optional(),
    name: z.string().min(1).max(100),
    detail: z.string().max(200),
    value: z.string().max(60),
  })).min(2).max(MAX_ITEMS),
  metrics: z.array(z.object({ label: z.string().max(48), value: z.string().max(48) })).min(2).max(4),
});
export type Content = z.infer<typeof contentSchema>;
export type Plan = { view: ViewType; accent: typeof accents[number]; visual?: typeof visuals[number]; variant?: typeof variants[number]; confidence: number; decisionMs: number; model: string };
export type Result = { plan: Plan; content: Content; generationModel: string; totalMs: number };
export const requestSchema = z.object({
  prompt: z.string().trim().min(3).max(1200),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(1600) })).max(6).default([]),
  previous: z.object({ view: viewSchema, content: contentSchema }).optional(),
}).strict();

export const viewNames: Record<ViewType, string> = {
  dashboard: 'Dashboard', checklist: 'Checklist', form: 'Form', pricing: 'Pricing', comparison: 'Comparison', itinerary: 'Itinerary', board: 'Board', gallery: 'Gallery',
  calendar: 'Calendar', calculator: 'Calculator', accordion: 'Questions', timer: 'Timer',
};
