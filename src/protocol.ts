// The header is absent in tabs opened before twelve-item interfaces shipped.
export const CONTENT_PROTOCOL = '2';
export const PROTOCOL_HEADER = 'X-Pico-Protocol';
export const MAX_ITEMS = 12;
export const LEGACY_MAX_ITEMS = 6;
export const legacyViews = new Set<string>(['dashboard', 'checklist', 'form', 'pricing', 'comparison', 'itinerary', 'board', 'gallery']);
