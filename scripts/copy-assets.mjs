import { cp, rm } from 'node:fs/promises';

await rm('assets', { force: true, recursive: true });
await cp('src/assets', 'assets', { recursive: true });
