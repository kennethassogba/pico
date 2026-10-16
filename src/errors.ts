export const GENERATION_FAILURE = 'Pico could not finish this interface. Try again.';

// Only intentional, actionable messages may cross the UI error boundary.
const messages = new Set([
  GENERATION_FAILURE,
  'Pico could not connect. Try again.',
  'Pico could not connect. Try again in a moment.',
  'Pico is busy. Wait a minute, then try again.',
  'The connection closed. Try again.',
  'The connection ended before the interface was ready. Try again.',
  'The model is busy. Wait a moment, then try again.',
  'The model connection needs attention. Try again later.',
  'The model connection is being configured. Try again later.',
  'The model is unavailable. Try again in a moment.',
  'The model could not complete this request. Try again.',
  'The model could not finish this interface. Try again.',
  'The model returned an incomplete interface. Try again.',
  'The model took too long. Try again with a shorter request.',
  'The response was too large. Try a shorter request.',
  'This request is too long. Shorten it and try again.',
  'Shorten your request and try again.',
  'Write a request between 3 and 1,200 characters, then try again.',
  'Open Pico on this site to generate an interface.',
]);

export function publicGenerationError(error: unknown): string {
  const message = error instanceof Error ? error.message : error;
  return typeof message === 'string' && messages.has(message) ? message : GENERATION_FAILURE;
}
