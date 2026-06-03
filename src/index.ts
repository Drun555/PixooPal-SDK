import { Buffer } from 'node:buffer';
import {
  createMediaAnimation,
  decodeGifFile,
  decodeImageFile,
  decodeVideoFile,
  type ImageFrame,
  type MediaAnimation,
  type MediaFrame
} from './media.js';
import { drawBitmapText, getBitmapTextRenderHeight, measureBitmapText } from './bitmap-text.js';

export type ClockfaceInputType =
  | 'button'
  | 'colorpicker'
  | 'input-text'
  | 'input-num'
  | 'input-file'
  | 'select';

export type ClockfaceData = Record<string, string>;
export type ClockfaceInputOption = {
  value: string;
  label: string;
};
export type ClockfacePersistedState = Record<string, unknown>;
export type ClockfacePixel = [number, number, number];
export type Pixel = ClockfacePixel;
export type Color = Pixel | string;
export type ClockfacePixelBuffer = ClockfacePixel[];
export type ClockfaceFileInputValue = {
  name: string;
  type: string;
  size: number;
  bytes: Uint8Array;
};
export type ClockfaceInputValue = string | ClockfaceFileInputValue;
export type ClockfacePersistence = {
  readonly state: ClockfacePersistedState;
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  update(values: ClockfacePersistedState): void;
};

export type ClockfaceContext = {
  resolution: number;
  data: ClockfaceData;
  inputs: ClockfaceInput[];
  buffer: ClockfacePixelBuffer;
  canvas: ClockfaceCanvas;
  persistence: ClockfacePersistence;
};

export type ClockfaceInputSubmitFunction = (
  value: ClockfaceInputValue,
  context: ClockfaceContext
) => void | Promise<void>;

export type ClockfaceInput = {
  type: ClockfaceInputType;
  id: string;
  friendlyName: string;
  options?: ClockfaceInputOption[];
  accept?: string;
  min?: number;
  max?: number;
  step?: number;
  isSetting?: boolean;
  onSubmit: ClockfaceInputSubmitFunction;
};
export type ClockfaceInputRow = ClockfaceInput | ClockfaceInput[];

export type ClockfaceLifecycleFunction = (context: ClockfaceContext) => void | Promise<void>;
export type ClockfaceResolutionFunction = (context: ClockfaceContext) => number;
export type ClockfaceUpdateIntervalFunction = (context: ClockfaceContext) => number;
export type ClockfaceResolution = number | ClockfaceResolutionFunction;

export type ClockfaceOptions = {
  resolution: ClockfaceResolution;
  data: ClockfaceData;
  inputs: ClockfaceInputRow[];
  updateIntervalMs?: number;
  getUpdateIntervalMs?: ClockfaceUpdateIntervalFunction;
  frameQueueSize?: number;
  persistedState?: ClockfacePersistedState;
  init: ClockfaceLifecycleFunction;
  main: ClockfaceLifecycleFunction;
  start?: ClockfaceLifecycleFunction;
  stop?: ClockfaceLifecycleFunction;
};

export type DrawStyleOptions = {
  fill?: Color;
  stroke?: Color;
  opacity?: number;
};

export type PixelDrawOptions = {
  fill?: Color;
  opacity?: number;
};

export type TextDrawOptions = {
  fill?: Color;
  fontName?: string;
  opacity?: number;
};

export type MediaType = 'image' | 'gif' | 'video';

export type MediaDrawOptions = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type MediaAsset = string | ClockfaceFileInputValue | PreparedMediaAsset;

export type PreparedImageAsset = {
  type: 'image';
  frame: ImageFrame;
};

export type PreparedAnimatedMediaAsset = {
  type: 'gif' | 'video';
  animation: MediaAnimation;
  width?: number;
  height?: number;
};

export type PreparedMediaAsset = PreparedImageAsset | PreparedAnimatedMediaAsset;

export type ClockfaceCanvas = {
  readonly size: number;
  readonly buffer: ClockfacePixelBuffer;
  clear(fill?: Color): void;
  pixel(x: number, y: number, colorOrOptions: Color | PixelDrawOptions): void;
  rect(x: number, y: number, width: number, height: number, options?: Color | DrawStyleOptions): void;
  circle(x: number, y: number, radius: number, options?: Color | DrawStyleOptions): void;
  text(text: string, x: number, y: number, options?: TextDrawOptions): void;
  media(asset: MediaAsset, type: MediaType, options?: MediaDrawOptions): void;
  toFlatBuffer(): number[];
};

type MediaCacheEntry =
  | {
      status: 'pending';
      promise: Promise<PreparedMediaAsset>;
    }
  | {
      status: 'ready';
      asset: PreparedMediaAsset;
    }
  | {
      status: 'error';
      error: unknown;
    };

export type DataField<T extends string = string> = {
  default: T;
};

export type DataSchema = Record<string, DataField<string>>;
export type InferData<TSchema extends DataSchema> = {
  [Key in keyof TSchema]: TSchema[Key]['default'];
};

export type FriendlyClockfaceContext<TData extends ClockfaceData = ClockfaceData> =
  Omit<ClockfaceContext, 'data'> & {
    data: TData;
  };

export type FriendlyClockfaceInput<TData extends ClockfaceData = ClockfaceData> =
  Omit<ClockfaceInput, 'onSubmit'> & {
    onSubmit?: (value: ClockfaceInputValue, context: FriendlyClockfaceContext<TData>) => void | Promise<void>;
  };

export type FriendlyClockfaceOptions<TSchema extends DataSchema> = {
  resolution: number | ((context: FriendlyClockfaceContext<InferData<TSchema>>) => number);
  data?: TSchema;
  inputs?: FriendlyClockfaceInput<InferData<TSchema>>[] | FriendlyClockfaceInput<InferData<TSchema>>[][];
  interval?: number;
  getInterval?: (context: FriendlyClockfaceContext<InferData<TSchema>>) => number;
  frameQueueSize?: number;
  setup?: (context: FriendlyClockfaceContext<InferData<TSchema>>) => void | Promise<void>;
  render: (context: FriendlyClockfaceContext<InferData<TSchema>>) => void | Promise<void>;
  start?: (context: FriendlyClockfaceContext<InferData<TSchema>>) => void | Promise<void>;
  stop?: (context: FriendlyClockfaceContext<InferData<TSchema>>) => void | Promise<void>;
};

export type PersistedClockfaceEntry = {
  data: ClockfaceData;
  state: ClockfacePersistedState;
};

export type ClockfacePersistenceStore = {
  read(key: string): PersistedClockfaceEntry | Promise<PersistedClockfaceEntry>;
  write(key: string, entry: PersistedClockfaceEntry): void | Promise<void>;
};

let persistenceStore: ClockfacePersistenceStore | undefined;

export class Clockface {
  private currentResolution: number;
  private readonly resolutionOption: ClockfaceResolution;
  readonly data: ClockfaceData;
  readonly inputs: ClockfaceInput[];
  readonly inputRows: ClockfaceInput[][];
  private pixelBuffer: ClockfacePixelBuffer;
  readonly ready: Promise<void>;
  readonly frameQueueSize: number;
  private readonly defaultUpdateIntervalMs: number;
  private readonly getUpdateIntervalMsFn?: ClockfaceUpdateIntervalFunction;
  private readonly initFn: ClockfaceLifecycleFunction;
  private readonly mainFn: ClockfaceLifecycleFunction;
  private readonly startFn?: ClockfaceLifecycleFunction;
  private readonly stopFn?: ClockfaceLifecycleFunction;
  private persistenceKey = '';
  private persistedState: ClockfacePersistedState;
  private persistenceReady: Promise<void>;
  private readonly mediaCache = new Map<object | string, MediaCacheEntry>();

  static configurePersistence(store: ClockfacePersistenceStore | undefined) {
    persistenceStore = store;
  }

  constructor({
    resolution,
    data,
    inputs,
    updateIntervalMs = 0,
    getUpdateIntervalMs,
    frameQueueSize,
    persistedState = {},
    init,
    main,
    start,
    stop
  }: ClockfaceOptions) {
    this.resolutionOption = resolution;
    this.data = data;
    this.inputRows = normalizeInputRows(inputs);
    this.inputs = this.inputRows.flat();
    this.currentResolution = this.resolveResolution(64, createBuffer(64));
    this.pixelBuffer = createBuffer(this.currentResolution);
    this.defaultUpdateIntervalMs = normalizeUpdateInterval(updateIntervalMs);
    this.getUpdateIntervalMsFn = getUpdateIntervalMs;
    this.frameQueueSize = normalizeFrameQueueSize(frameQueueSize);
    this.initFn = init;
    this.mainFn = main;
    this.startFn = start;
    this.stopFn = stop;
    this.persistedState = { ...persistedState };
    this.ready = this.run();
    this.persistenceReady = this.ready;
  }

  get resolution() {
    return this.ensureResolution();
  }

  get buffer() {
    this.ensureResolution();
    return this.pixelBuffer;
  }

  get context(): ClockfaceContext {
    this.ensureResolution();
    return {
      resolution: this.currentResolution,
      data: this.data,
      inputs: this.inputs,
      buffer: this.pixelBuffer,
      canvas: createCanvas(this.currentResolution, this.pixelBuffer, this.mediaCache),
      persistence: this.persistence
    };
  }

  get flatBuffer() {
    return this.buffer.flat();
  }

  getFrame() {
    return {
      size: this.resolution,
      buffer: this.flatBuffer
    };
  }

  get updateIntervalMs() {
    return normalizeUpdateInterval(this.getUpdateIntervalMsFn?.(this.context) ?? this.defaultUpdateIntervalMs);
  }

  get persistence(): ClockfacePersistence {
    const clockface = this;

    return {
      get state() {
        return clockface.persistedState;
      },
      get: <T>(key: string, fallback: T) => {
        const value = this.persistedState[key];
        return value === undefined ? fallback : (value as T);
      },
      set: (key: string, value: unknown) => {
        this.persistedState = {
          ...this.persistedState,
          [key]: value
        };
        this.persist();
      },
      update: (values: ClockfacePersistedState) => {
        this.persistedState = {
          ...this.persistedState,
          ...values
        };
        this.persist();
      }
    };
  }

  async attachPersistence(key: string) {
    this.persistenceKey = key;

    this.persistenceReady = this.ready.then(async () => {
      const persisted = await readPersistedClockface(key);
      Object.assign(this.data, persisted.data);
      this.persistedState = { ...this.persistedState, ...persisted.state };
      await this.initFn(this.context);
      await this.mainFn(this.context);
    });

    await this.persistenceReady;
  }

  async waitForPersistence() {
    await this.persistenceReady;
  }

  async submitInput(id: string, value: ClockfaceInputValue) {
    await this.waitForPersistence();

    const input = this.inputs.find((item) => item.id === id);

    if (!input) {
      throw new Error(`Clockface input "${id}" was not found.`);
    }

    await input.onSubmit(value, this.context);
    await this.persist();
  }

  async render() {
    await this.waitForPersistence();
    await this.mainFn(this.context);
  }

  async start() {
    await this.waitForPersistence();
    await this.startFn?.(this.context);
  }

  async stop() {
    await this.waitForPersistence();
    await this.stopFn?.(this.context);
  }

  private async run() {
    await this.initFn(this.context);
    await this.mainFn(this.context);
  }

  private async persist() {
    if (!this.persistenceKey || !persistenceStore) {
      return;
    }

    await persistenceStore.write(this.persistenceKey, {
      data: { ...this.data },
      state: { ...this.persistedState }
    });
  }

  private ensureResolution() {
    const nextResolution = this.resolveResolution(this.currentResolution, this.pixelBuffer);

    if (nextResolution !== this.currentResolution) {
      this.currentResolution = nextResolution;
      this.pixelBuffer = createBuffer(nextResolution);
      this.mediaCache.clear();
    }

    return this.currentResolution;
  }

  private resolveResolution(currentResolution: number, buffer: ClockfacePixelBuffer) {
    if (typeof this.resolutionOption === 'number') {
      return normalizeResolution(this.resolutionOption);
    }

    return normalizeResolution(this.resolutionOption(this.createContext(currentResolution, buffer)));
  }

  private createContext(resolution: number, buffer: ClockfacePixelBuffer): ClockfaceContext {
    return {
      resolution,
      data: this.data,
      inputs: this.inputs,
      buffer,
      canvas: createCanvas(resolution, buffer, this.mediaCache),
      persistence: this.persistence
    };
  }
}

function createBuffer(resolution: number): ClockfacePixelBuffer {
  const normalizedResolution = normalizeResolution(resolution);

  return Array.from({ length: normalizedResolution * normalizedResolution }, () => [0, 0, 0]);
}

function normalizeResolution(resolution: number) {
  if (!Number.isInteger(resolution) || resolution <= 0) {
    throw new Error('Clockface resolution must be a positive integer.');
  }

  return resolution;
}

function normalizeInputRows(inputs: ClockfaceInputRow[]) {
  return inputs.map((input) => (Array.isArray(input) ? input : [input]));
}

function normalizeUpdateInterval(updateIntervalMs: number) {
  if (!Number.isFinite(updateIntervalMs) || updateIntervalMs <= 0) {
    return 0;
  }

  return Math.max(50, Math.round(updateIntervalMs));
}

function normalizeFrameQueueSize(frameQueueSize: number | undefined) {
  if (frameQueueSize === undefined || !Number.isFinite(frameQueueSize)) {
    return 5;
  }

  return Math.max(1, Math.round(frameQueueSize));
}

async function readPersistedClockface(key: string) {
  if (!persistenceStore) {
    return {
      data: {},
      state: {}
    };
  }

  const persisted = await persistenceStore.read(key);

  return {
    data: sanitizeData(persisted.data),
    state: sanitizeState(persisted.state)
  };
}

function sanitizeData(value: unknown): ClockfaceData {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
}

function sanitizeState(value: unknown): ClockfacePersistedState {
  return isRecord(value) ? { ...value } : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const color = {
  black: [0, 0, 0] as Pixel,
  white: [255, 255, 255] as Pixel,
  parse: parseColor,
  mix(start: Color, end: Color, amount: number): Pixel {
    const left = parseColor(start);
    const right = parseColor(end);
    const clamped = clamp(amount, 0, 1);

    return [
      Math.round(left[0] + (right[0] - left[0]) * clamped),
      Math.round(left[1] + (right[1] - left[1]) * clamped),
      Math.round(left[2] + (right[2] - left[2]) * clamped)
    ];
  }
};

export const data = {
  string(defaultValue = ''): DataField<string> {
    return { default: defaultValue };
  },
  number(defaultValue = 0): DataField<string> {
    return { default: String(defaultValue) };
  },
  color(defaultValue = '#ffffff'): DataField<string> {
    return { default: defaultValue };
  },
  select(defaultValue: string): DataField<string> {
    return { default: defaultValue };
  }
};

export const input = {
  text(id: string, friendlyName: string, options: Partial<FriendlyClockfaceInput> = {}) {
    return createInput('input-text', id, friendlyName, options);
  },
  number(id: string, friendlyName: string, options: Partial<FriendlyClockfaceInput> = {}) {
    return createInput('input-num', id, friendlyName, options);
  },
  color(id: string, friendlyName: string, options: Partial<FriendlyClockfaceInput> = {}) {
    return createInput('colorpicker', id, friendlyName, options);
  },
  file(id: string, friendlyName: string, options: Partial<FriendlyClockfaceInput> = {}) {
    return createInput('input-file', id, friendlyName, options);
  },
  select(
    id: string,
    friendlyName: string,
    options: ClockfaceInputOption[],
    inputOptions: Partial<FriendlyClockfaceInput> = {}
  ) {
    return createInput('select', id, friendlyName, { ...inputOptions, options });
  },
  button(id: string, friendlyName: string, options: Partial<FriendlyClockfaceInput> = {}) {
    return createInput('button', id, friendlyName, options);
  }
};

export function defineClockface<TSchema extends DataSchema = Record<string, never>>(
  options: FriendlyClockfaceOptions<TSchema>
) {
  const defaultData = Object.fromEntries(
    Object.entries(options.data ?? {}).map(([key, field]) => [key, field.default])
  ) as InferData<TSchema>;

  return new Clockface({
    resolution: options.resolution as ClockfaceResolution,
    data: defaultData,
    inputs: normalizeFriendlyInputs(options.inputs ?? []),
    updateIntervalMs: options.interval,
    getUpdateIntervalMs: options.getInterval as ClockfaceUpdateIntervalFunction | undefined,
    frameQueueSize: options.frameQueueSize,
    init: async (context) => {
      await options.setup?.(context as FriendlyClockfaceContext<InferData<TSchema>>);
    },
    main: options.render as ClockfaceLifecycleFunction,
    start: options.start as ClockfaceLifecycleFunction | undefined,
    stop: options.stop as ClockfaceLifecycleFunction | undefined
  });
}

function createInput(
  type: ClockfaceInputType,
  id: string,
  friendlyName: string,
  options: Partial<FriendlyClockfaceInput>
): FriendlyClockfaceInput {
  return {
    type,
    id,
    friendlyName,
    isSetting: false,
    ...options
  };
}

function normalizeFriendlyInputs(inputs: unknown): ClockfaceInputRow[] {
  if (!Array.isArray(inputs)) {
    return [];
  }

  return inputs.map((row) => {
    if (Array.isArray(row)) {
      return row.map((inputDefinition) => normalizeFriendlyInput(inputDefinition as FriendlyClockfaceInput));
    }

    return normalizeFriendlyInput(row as FriendlyClockfaceInput);
  });
}

function normalizeFriendlyInput(inputDefinition: FriendlyClockfaceInput): ClockfaceInput {
  return {
    ...inputDefinition,
    onSubmit: async (value, context) => {
      if (inputDefinition.type !== 'button' && inputDefinition.id in context.data) {
        context.data[inputDefinition.id] = String(value);
      }

      await inputDefinition.onSubmit?.(value, context);
    }
  };
}

function createCanvas(
  size: number,
  buffer: ClockfacePixelBuffer,
  mediaCache: Map<object | string, MediaCacheEntry>
): ClockfaceCanvas {
  return {
    get size() {
      return size;
    },
    get buffer() {
      return buffer;
    },
    clear(fill: Color = color.black) {
      const pixel = parseColor(fill);

      for (let index = 0; index < buffer.length; index += 1) {
        buffer[index] = [...pixel];
      }
    },
    pixel(x: number, y: number, colorOrOptions: Color | PixelDrawOptions) {
      const options = normalizePixelOptions(colorOrOptions);
      writePixel(buffer, size, x, y, parseColor(options.fill), options.opacity);
    },
    rect(x: number, y: number, width: number, height: number, options: Color | DrawStyleOptions = {}) {
      const style = normalizeDrawStyle(options);
      const startX = Math.round(x);
      const startY = Math.round(y);
      const endX = startX + Math.round(width) - 1;
      const endY = startY + Math.round(height) - 1;

      if (style.fill) {
        for (let targetY = startY; targetY <= endY; targetY += 1) {
          for (let targetX = startX; targetX <= endX; targetX += 1) {
            writePixel(buffer, size, targetX, targetY, style.fill, style.opacity);
          }
        }
      }

      if (style.stroke) {
        for (let targetX = startX; targetX <= endX; targetX += 1) {
          writePixel(buffer, size, targetX, startY, style.stroke, style.opacity);
          writePixel(buffer, size, targetX, endY, style.stroke, style.opacity);
        }

        for (let targetY = startY; targetY <= endY; targetY += 1) {
          writePixel(buffer, size, startX, targetY, style.stroke, style.opacity);
          writePixel(buffer, size, endX, targetY, style.stroke, style.opacity);
        }
      }
    },
    circle(x: number, y: number, radius: number, options: Color | DrawStyleOptions = {}) {
      const style = normalizeDrawStyle(options);
      const centerX = Math.round(x);
      const centerY = Math.round(y);
      const normalizedRadius = Math.max(0, Math.round(radius));
      const radiusSquared = normalizedRadius * normalizedRadius;
      const innerRadiusSquared = Math.max(0, normalizedRadius - 1) ** 2;

      for (let offsetY = -normalizedRadius; offsetY <= normalizedRadius; offsetY += 1) {
        for (let offsetX = -normalizedRadius; offsetX <= normalizedRadius; offsetX += 1) {
          const distanceSquared = offsetX * offsetX + offsetY * offsetY;

          if (style.fill && distanceSquared <= radiusSquared) {
            writePixel(buffer, size, centerX + offsetX, centerY + offsetY, style.fill, style.opacity);
          }

          if (
            style.stroke &&
            distanceSquared <= radiusSquared &&
            distanceSquared >= innerRadiusSquared
          ) {
            writePixel(buffer, size, centerX + offsetX, centerY + offsetY, style.stroke, style.opacity);
          }
        }
      }
    },
    text(text: string, x: number, y: number, options: TextDrawOptions = {}) {
      const fill = parseColor(options.fill ?? color.white);
      const opacity = normalizeOpacity(options.opacity);
      const width = Math.min(size, measureBitmapText(text, options.fontName));
      const height = Math.min(size, getBitmapTextRenderHeight(text, options.fontName));
      const mask = new Array(size * size * 3).fill(0);

      drawBitmapText({
        buffer: mask,
        size,
        text,
        x: 0,
        y: 0,
        color: color.white
      });

      for (let sourceY = 0; sourceY < height; sourceY += 1) {
        for (let sourceX = 0; sourceX < width; sourceX += 1) {
          const sourceIndex = (sourceX + sourceY * size) * 3;

          if ((mask[sourceIndex] ?? 0) < 128) {
            continue;
          }

          writePixel(buffer, size, Math.round(x) + sourceX, Math.round(y) + sourceY, fill, opacity);
        }
      }
    },
    media(asset: MediaAsset, type: MediaType, options: MediaDrawOptions = {}) {
      const prepared = isPreparedMediaAsset(asset)
        ? asset
        : getPreparedMediaAsset(asset, type, size, mediaCache);

      if (!prepared) {
        return;
      }

      const frame = getPreparedMediaFrame(prepared);

      drawFrameIntoBuffer(buffer, size, frame, options);
    },
    toFlatBuffer() {
      return buffer.flat();
    }
  };
}

function normalizePixelOptions(value: Color | PixelDrawOptions): Required<PixelDrawOptions> {
  if (typeof value === 'string' || Array.isArray(value)) {
    return {
      fill: value,
      opacity: 1
    };
  }

  return {
    fill: value.fill ?? color.white,
    opacity: normalizeOpacity(value.opacity)
  };
}

function normalizeDrawStyle(value: Color | DrawStyleOptions): { fill?: Pixel; stroke?: Pixel; opacity: number } {
  if (typeof value === 'string' || Array.isArray(value)) {
    return {
      fill: parseColor(value),
      opacity: 1
    };
  }

  return {
    fill: value.fill === undefined && value.stroke === undefined ? color.white : parseOptionalColor(value.fill),
    stroke: parseOptionalColor(value.stroke),
    opacity: normalizeOpacity(value.opacity)
  };
}

function parseOptionalColor(value: Color | undefined) {
  return value === undefined ? undefined : parseColor(value);
}

function parseColor(value: Color): Pixel {
  if (Array.isArray(value)) {
    return [
      clampColorChannel(value[0]),
      clampColorChannel(value[1]),
      clampColorChannel(value[2])
    ];
  }

  const normalized = value.trim();
  const match = normalized.match(/^#?([0-9a-f]{6})$/i);

  if (!match) {
    throw new Error(`Color "${value}" must be a RGB tuple or a #rrggbb string.`);
  }

  const hex = match[1];

  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16)
  ];
}

function clampColorChannel(value: number) {
  return clamp(Math.round(value), 0, 255);
}

function normalizeOpacity(value: number | undefined) {
  return clamp(Number.isFinite(value) ? value ?? 1 : 1, 0, 1);
}

function writePixel(
  buffer: ClockfacePixelBuffer,
  size: number,
  x: number,
  y: number,
  fill: Pixel,
  opacity = 1
) {
  const targetX = Math.round(x);
  const targetY = Math.round(y);

  if (targetX < 0 || targetY < 0 || targetX >= size || targetY >= size) {
    return;
  }

  const index = targetX + targetY * size;
  const current = buffer[index] ?? color.black;
  buffer[index] = opacity >= 1 ? [...fill] : color.mix(current, fill, opacity);
}

function drawFrameIntoBuffer(
  buffer: ClockfacePixelBuffer,
  size: number,
  frame: ImageFrame | MediaFrame,
  options: MediaDrawOptions
) {
  const sourceWidth = 'width' in frame ? frame.width : Math.sqrt(frame.pixels.length);
  const sourceHeight = 'height' in frame ? frame.height : sourceWidth;
  const targetX = Math.round(options.x ?? 0);
  const targetY = Math.round(options.y ?? 0);
  const targetWidth = Math.max(1, Math.round(options.width ?? sourceWidth));
  const targetHeight = Math.max(1, Math.round(options.height ?? sourceHeight));

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(sourceHeight - 1, Math.floor((y / targetHeight) * sourceHeight));

    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor((x / targetWidth) * sourceWidth));
      const sourcePixel = frame.pixels[sourceX + sourceY * sourceWidth];

      if (!sourcePixel) {
        continue;
      }

      writePixel(buffer, size, targetX + x, targetY + y, sourcePixel);
    }
  }
}

function isPreparedMediaAsset(asset: MediaAsset): asset is PreparedMediaAsset {
  return typeof asset === 'object' && 'type' in asset && (asset.type === 'image' || asset.type === 'gif' || asset.type === 'video') && (
    'frame' in asset || 'animation' in asset
  );
}

function getPreparedMediaAsset(
  asset: string | ClockfaceFileInputValue,
  type: MediaType,
  resolution: number,
  mediaCache: Map<object | string, MediaCacheEntry>
) {
  const cached = mediaCache.get(asset);

  if (cached?.status === 'ready') {
    return cached.asset;
  }

  if (cached) {
    return undefined;
  }

  const promise = prepareMediaAsset(normalizeMediaAsset(asset, type), type, resolution)
    .then((prepared) => {
      mediaCache.set(asset, {
        status: 'ready',
        asset: prepared
      });
      return prepared;
    })
    .catch((error: unknown) => {
      mediaCache.set(asset, {
        status: 'error',
        error
      });
      throw error;
    });

  promise.catch(() => undefined);
  mediaCache.set(asset, {
    status: 'pending',
    promise
  });

  return undefined;
}

function normalizeMediaAsset(asset: string | ClockfaceFileInputValue, type: MediaType): ClockfaceFileInputValue {
  if (typeof asset !== 'string') {
    return asset;
  }

  const dataUrl = parseDataUrl(asset);
  const extension = getMediaTypeExtension(dataUrl.type, type);

  return {
    name: `asset.${extension}`,
    type: dataUrl.type,
    size: dataUrl.bytes.byteLength,
    bytes: dataUrl.bytes
  };
}

function parseDataUrl(value: string) {
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);

  if (!match) {
    throw new Error('Imported media assets must be data URLs.');
  }

  const mimeType = match[1] || 'application/octet-stream';
  const encoded = match[3] ?? '';
  const bytes = match[2]
    ? decodeBase64(encoded)
    : new TextEncoder().encode(decodeURIComponent(encoded));

  return {
    type: mimeType,
    bytes
  };
}

function decodeBase64(value: string) {
  if (typeof atob === 'function') {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  }

  return Uint8Array.from(Buffer.from(value, 'base64'));
}

function getMediaTypeExtension(mimeType: string, type: MediaType) {
  const subtype = mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '').toLowerCase();

  if (subtype) {
    return subtype === 'jpeg' ? 'jpg' : subtype;
  }

  return type === 'image' ? 'png' : type;
}

async function prepareMediaAsset(
  asset: ClockfaceFileInputValue,
  type: MediaType,
  resolution: number
): Promise<PreparedMediaAsset> {
  if (type === 'image') {
    return {
      type,
      frame: await decodeImageFile(asset, { resolution })
    };
  }

  const frames =
    type === 'gif'
      ? await decodeGifFile(asset, { resolution })
      : await decodeVideoFile(asset, { resolution });

  return {
    type,
    animation: createMediaAnimation(frames),
    width: resolution,
    height: resolution
  };
}

function getPreparedMediaFrame(asset: PreparedMediaAsset) {
  if (asset.type === 'image') {
    return asset.frame;
  }

  return asset.animation.getCurrentFrame();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
