import { defineConfig } from "tsup";
import copyTemplate from "./plugins/copyTemplate";

export default defineConfig({
  target: "node18",
  entry: ["index.ts"],
  clean: true,
  format: ["cjs"],
  minify: true,
  platform: "node",
  outDir: "dist",
  esbuildPlugins: [copyTemplate],
});
