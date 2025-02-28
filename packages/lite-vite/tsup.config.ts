import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  splitting: false,
  format: "cjs",
  clean: false,
  dts: true,
  external: ["sourcemap", "rollup"],
});
