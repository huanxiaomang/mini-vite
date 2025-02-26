import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['index.ts'],
    splitting: false,
    sourcemap: true,
    format: 'cjs',
    clean: false,
    dts: true,
});
