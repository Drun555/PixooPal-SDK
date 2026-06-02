import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { defineClockface, type PreparedMediaAsset } from '../src/index.js';
import {
  createMediaAnimation,
  decodeGifFile,
  decodeImageFile,
  drawImageFile,
  drawMediaFrame,
  normalizeGifPlaybackSpeed
} from '../src/media.js';

describe('media helpers', () => {
  it('normalizes playback speed and draws frames', async () => {
    const clockface = defineClockface({
      resolution: 1,
      render: () => undefined
    });

    await clockface.ready;
    drawMediaFrame(clockface.context, { pixels: [[9, 8, 7]], delay: 50 });

    expect(clockface.buffer[0]).toEqual([9, 8, 7]);
    expect(normalizeGifPlaybackSpeed('bad')).toBe(1);
    expect(normalizeGifPlaybackSpeed(99)).toBe(8);
  });

  it('selects the current animation frame', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    const animation = createMediaAnimation([
      { pixels: [[1, 0, 0]], delay: 100 },
      { pixels: [[0, 1, 0]], delay: 100 }
    ]);

    vi.setSystemTime(1150);
    expect(animation.getCurrentFrame().pixels[0]).toEqual([0, 1, 0]);

    vi.useRealTimers();
  });

  it('decodes a tiny gif fixture', async () => {
    const bytes = Uint8Array.from(Buffer.from('R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'));
    const frames = await decodeGifFile(
      {
        name: 'tiny.gif',
        type: 'image/gif',
        size: bytes.byteLength,
        bytes
      },
      { resolution: 1 }
    );

    expect(frames).toHaveLength(1);
    expect(frames[0].pixels).toHaveLength(1);
  });

  it('decodes and draws a static image file', async () => {
    const bytes = new Uint8Array(
      await sharp({
        create: {
          width: 1,
          height: 1,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()
    );
    const file = {
      name: 'red.png',
      type: 'image/png',
      size: bytes.byteLength,
      bytes
    };
    const frame = await decodeImageFile(file, { resolution: 1 });
    const clockface = defineClockface({
      resolution: 1,
      render: () => undefined
    });

    await clockface.ready;
    expect(frame.width).toBe(1);
    expect(frame.height).toBe(1);
    expect(frame.pixels).toEqual([[255, 0, 0]]);

    await drawImageFile(clockface.context, file);
    expect(clockface.buffer[0]).toEqual([255, 0, 0]);
  });

  it('draws a static image at an offset', async () => {
    const bytes = new Uint8Array(
      await sharp({
        create: {
          width: 2,
          height: 2,
          channels: 3,
          background: { r: 0, g: 255, b: 0 }
        }
      })
        .png()
        .toBuffer()
    );
    const file = {
      name: 'green.png',
      type: 'image/png',
      size: bytes.byteLength,
      bytes
    };
    const clockface = defineClockface({
      resolution: 3,
      render: () => undefined
    });

    await clockface.ready;
    await drawImageFile(clockface.context, file, { width: 2, height: 2, fit: 'fill', x: 1, y: 1 });

    expect(clockface.buffer[0]).toEqual([0, 0, 0]);
    expect(clockface.buffer[4]).toEqual([0, 255, 0]);
    expect(clockface.buffer[5]).toEqual([0, 255, 0]);
    expect(clockface.buffer[7]).toEqual([0, 255, 0]);
    expect(clockface.buffer[8]).toEqual([0, 255, 0]);
  });

  it('draws raw and prepared media through canvas.media', async () => {
    const bytes = new Uint8Array(
      await sharp({
        create: {
          width: 1,
          height: 1,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()
    );
    const file = {
      name: 'red.png',
      type: 'image/png',
      size: bytes.byteLength,
      bytes
    };
    const prepared: PreparedMediaAsset = {
      type: 'image',
      frame: {
        width: 1,
        height: 1,
        pixels: [[0, 0, 255]]
      }
    };
    const clockface = defineClockface({
      resolution: 2,
      render: () => undefined
    });

    await clockface.ready;
    clockface.context.canvas.media(file, 'image', { x: 0, y: 0, width: 1, height: 1 });
    clockface.context.canvas.media(prepared, 'image', { x: 1, y: 1 });

    expect(clockface.buffer[0]).toEqual([0, 0, 0]);
    expect(clockface.buffer[3]).toEqual([0, 0, 255]);
  });
});
