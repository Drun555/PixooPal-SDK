Repository of a Clockface SDK: https://www.npmjs.com/package/@pixoopal/clockface

Examples of usage can be found [here](https://github.com/Drun555/PixooPal-Community)

## Pixel buffer layout

Since `0.2.0`, `ClockfacePixelBuffer` is a mutable flat RGB `Uint8Array`.
For a `size x size` frame, the buffer length is `size * size * 3`; pixel `(x, y)` starts at
`(x + y * size) * 3`.

Prefer canvas helpers in clockface code:

```ts
const current = context.canvas.getPixel(x, y);
context.canvas.pixel(x, y, [255, 255, 255]);
context.canvas.blendPixel(x, y, [80, 180, 255], 0.5);
```
