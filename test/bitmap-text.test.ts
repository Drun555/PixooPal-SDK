import { describe, expect, it } from 'vitest';
import { drawBitmapText, getBitmapTextRenderHeight, measureBitmapText } from '../src/bitmap-text.js';

describe('bitmap text helpers', () => {
  it('measures and draws text into a flat buffer', async () => {
    const buffer = new Array(64 * 64 * 3).fill(0);

    expect(measureBitmapText('Hi')).toBeGreaterThan(0);
    expect(getBitmapTextRenderHeight('Hi')).toBeGreaterThan(0);

    await drawBitmapText({
      buffer,
      size: 64,
      text: 'Hi',
      x: 0,
      y: 0,
      color: [255, 0, 0]
    });

    expect(buffer.some((value) => value !== 0)).toBe(true);
  });
});
