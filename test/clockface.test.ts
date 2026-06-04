import { describe, expect, it } from 'vitest';
import {
  Clockface,
  color,
  data,
  defineClockface,
  input,
  type ClockfacePixelBuffer,
  type PersistedClockfaceEntry
} from '../src/index.js';

function pixelAt(buffer: ClockfacePixelBuffer, size: number, x: number, y: number) {
  const index = (x + y * size) * 3;
  return Array.from(buffer.slice(index, index + 3));
}

describe('Clockface', () => {
  it('creates a buffer and runs lifecycle hooks', async () => {
    const calls: string[] = [];
    const clockface = defineClockface({
      resolution: 2,
      data: {
        value: data.string('a')
      },
      setup: ({ canvas }) => {
        calls.push('setup');
        canvas.pixel(0, 0, [1, 2, 3]);
      },
      render: () => {
        calls.push('render');
      }
    });

    await clockface.ready;

    expect(clockface.buffer).toHaveLength(12);
    expect(pixelAt(clockface.buffer, 2, 0, 0)).toEqual([1, 2, 3]);
    expect(calls).toEqual(['setup', 'render']);
  });

  it('does not clear automatically between renders', async () => {
    const clockface = defineClockface({
      resolution: 2,
      render: ({ canvas }) => {
        canvas.pixel(0, 0, '#ff0000');
      }
    });

    await clockface.ready;
    clockface.context.canvas.pixel(1, 1, '#00ff00');
    await clockface.render();

    expect(pixelAt(clockface.buffer, 2, 0, 0)).toEqual([255, 0, 0]);
    expect(pixelAt(clockface.buffer, 2, 1, 1)).toEqual([0, 255, 0]);
  });

  it('exposes the configured frame queue size', () => {
    const clockface = defineClockface({
      resolution: 1,
      frameQueueSize: 1,
      render: () => undefined
    });

    expect(clockface.frameQueueSize).toBe(1);
  });

  it('supports dynamic resolution from clockface data', async () => {
    const clockface = defineClockface({
      resolution: (context) => Number(context.data.size),
      data: {
        size: data.select('2')
      },
      inputs: [
        input.select('size', 'Size', [
          { value: '2', label: '2x2' },
          { value: '3', label: '3x3' }
        ])
      ],
      render: ({ canvas, resolution }) => {
        canvas.clear();
        canvas.pixel(resolution - 1, resolution - 1, '#ffffff');
      }
    });

    await clockface.ready;

    expect(clockface.resolution).toBe(2);
    expect(clockface.buffer).toHaveLength(12);
    expect(clockface.getFrame().size).toBe(2);
    expect(Array.from(clockface.getFrame().buffer)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255
    ]);

    await clockface.submitInput('size', '3');
    await clockface.render();

    expect(clockface.resolution).toBe(3);
    expect(clockface.buffer).toHaveLength(27);
    expect(clockface.getFrame().size).toBe(3);
    expect(pixelAt(clockface.buffer, 3, 2, 2)).toEqual([255, 255, 255]);
  });

  it('draws primitives with clipping, stroke, fill and opacity', async () => {
    const clockface = defineClockface({
      resolution: 5,
      render: ({ canvas }) => {
        canvas.clear();
        canvas.rect(-1, -1, 3, 3, { fill: '#ff0000' });
        canvas.circle(2, 2, 1, { stroke: '#00ff00' });
        canvas.pixel(4, 4, { fill: '#0000ff', opacity: 0.5 });
      }
    });

    await clockface.ready;

    expect(pixelAt(clockface.buffer, 5, 0, 0)).toEqual([255, 0, 0]);
    expect(pixelAt(clockface.buffer, 5, 2, 1)).toEqual([0, 255, 0]);
    expect(pixelAt(clockface.buffer, 5, 4, 4)).toEqual([0, 0, 128]);
  });

  it('submits helper inputs and persists through an injected store', async () => {
    const writes: Record<string, PersistedClockfaceEntry> = {};

    Clockface.configurePersistence({
      read: () => ({ data: { text: 'persisted' }, state: { count: 1 } }),
      write: (key, entry) => {
        writes[key] = entry;
      }
    });

    const clockface = defineClockface({
      resolution: 1,
      data: {
        text: data.string('default')
      },
      inputs: [
        input.text('text', 'Text', {
          onSubmit: (_value, context) => {
            context.persistence.set('count', 2);
          }
        })
      ],
      render: () => undefined
    });

    await clockface.attachPersistence('sample');
    await clockface.submitInput('text', 'next');

    expect(clockface.data.text).toBe('next');
    expect(writes.sample).toEqual({
      data: { text: 'next' },
      state: { count: 2 }
    });

    Clockface.configurePersistence(undefined);
  });

  it('exposes color helpers', () => {
    expect(color.parse('#123456')).toEqual([18, 52, 86]);
    expect(color.mix('#000000', '#ffffff', 0.5)).toEqual([128, 128, 128]);
  });
});
