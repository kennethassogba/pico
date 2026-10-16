import { describe, expect, it } from 'vitest';
import { contentSchema } from '../src/schema';
import { GENERATION_FAILURE, publicGenerationError } from '../src/errors';

describe('public generation errors', () => {
  it('hides the exact array-limit error shown on older tabs', () => {
    const result = contentSchema.shape.items.max(6).safeParse(Array.from({ length: 8 }, () => ({ name: 'Food', detail: '', value: '25' })));
    expect(result.success).toBe(false);
    if (!result.success) expect(publicGenerationError(result.error)).toBe(GENERATION_FAILURE);
  });
  it('keeps known actionable recovery messages', () => {
    expect(publicGenerationError(new Error('Pico is busy. Wait a minute, then try again.'))).toBe('Pico is busy. Wait a minute, then try again.');
  });
  it('never displays raw JSON, transport details or arbitrary provider errors', () => {
    for (const error of [new SyntaxError('Unexpected token in JSON at position 42'), new Error('provider failed with internal credentials'), new Error('[{"code":"too_big","path":["items"]}]'), new TypeError('Failed to fetch'), null, { message: 'debug' }]) expect(publicGenerationError(error)).toBe(GENERATION_FAILURE);
  });
});
