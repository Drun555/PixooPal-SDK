import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';
import { defineClockface } from '../src/index.js';
import {
  configureBitmapTextAssets,
  drawBitmapText,
  getBitmapTextRenderHeight,
  measureBitmapText
} from '../src/bitmap-text.js';

describe('bitmap text helpers', () => {
  it('measures and draws text into a flat buffer', async () => {
    const buffer = new Uint8Array(64 * 64 * 3);

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

  it('draws text through canvas.text', async () => {
    const clockface = defineClockface({
      resolution: 64,
      render: ({ canvas }) => {
        canvas.clear();
        canvas.text('Hi', 0, 0, { fill: '#ff0000' });
      }
    });

    await clockface.ready;

    expect(clockface.buffer.some((value) => value !== 0)).toBe(true);
  });

  it('uses an available case variant before the fallback glyph', () => {
    configureBitmapTextAssets({
      fonts: {
        regular: {
          definition: [
            'common lineHeight=9',
            'char id=65 x=0 y=0 width=1 height=1 xoffset=0 yoffset=0 xadvance=7',
            'char id=63 x=0 y=0 width=1 height=1 xoffset=0 yoffset=0 xadvance=3'
          ].join('\n'),
          atlasPath: 'unused.png'
        }
      }
    });

    try {
      expect(measureBitmapText('a')).toBe(7);
      expect(measureBitmapText('z')).toBe(3);
    } finally {
      configureBitmapTextAssets({});
    }
  });

  it('ignores empty top and bottom emoji rows when measuring render height', () => {
    const directory = mkdtempSync(join(tmpdir(), 'pixoopal-emoji-'));
    const emojiAtlasPath = join(directory, 'emoji.png');
    const image = new PNG({ width: 4, height: 6 });

    for (let y = 1; y <= 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        const index = (x + y * image.width) * 4;
        image.data[index] = 255;
        image.data[index + 1] = 0;
        image.data[index + 2] = 0;
        image.data[index + 3] = 255;
      }
    }

    writeFileSync(emojiAtlasPath, PNG.sync.write(image));
    configureBitmapTextAssets({
      fonts: {
        regular: {
          definition: [
            'common lineHeight=1',
            'char id=63 x=0 y=0 width=1 height=1 xoffset=0 yoffset=0 xadvance=3'
          ].join('\n'),
          atlasPath: 'unused.png'
        }
      },
      emojiAtlasPath,
      emojiManifest: {
        sheet: 'emoji.png',
        cellSize: 6,
        width: 4,
        height: 6,
        columns: 1,
        rows: 1,
        count: 1,
        entries: {
          '🙂': {
            index: 0,
            x: 0,
            y: 0,
            width: 4,
            height: 6,
            visible: true,
            codepoints: ['1f642']
          }
        }
      }
    });

    try {
      expect(getBitmapTextRenderHeight('🙂')).toBe(4);
    } finally {
      configureBitmapTextAssets({});
    }
  });
});
