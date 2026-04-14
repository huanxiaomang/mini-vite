import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["cjs"],
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
});
