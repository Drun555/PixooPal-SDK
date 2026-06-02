import { describe, expect, it } from 'vitest';
import { Clockface, type PersistedClockfaceEntry } from '../src/index.js';

describe('Clockface', () => {
  it('creates a buffer and runs lifecycle hooks', async () => {
    const calls: string[] = [];
    const clockface = new Clockface({
      resolution: 2,
      data: { value: 'a' },
      inputs: [],
      init: ({ buffer }) => {
        calls.push('init');
        buffer[0] = [1, 2, 3];
      },
      main: () => {
        calls.push('main');
      }
    });

    await clockface.ready;

    expect(clockface.buffer).toHaveLength(4);
    expect(clockface.flatBuffer.slice(0, 3)).toEqual([1, 2, 3]);
    expect(calls).toEqual(['init', 'main']);
  });

  it('submits inputs and persists through an injected store', async () => {
    const writes: Record<string, PersistedClockfaceEntry> = {};

    Clockface.configurePersistence({
      read: () => ({ data: { text: 'persisted' }, state: { count: 1 } }),
      write: (key, entry) => {
        writes[key] = entry;
      }
    });

    const clockface = new Clockface({
      resolution: 1,
      data: { text: 'default' },
      inputs: [
        {
          type: 'input-text',
          id: 'text',
          friendlyName: 'Text',
          onSubmit: (value, context) => {
            context.data.text = String(value);
            context.persistence.set('count', 2);
          }
        }
      ],
      init: () => undefined,
      main: () => undefined
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
});
