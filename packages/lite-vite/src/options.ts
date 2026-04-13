import { existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { log } from "@lite-vite/shared";
import { defaultPlugins } from "./plugins";
import { ROOT } from "./constant";
import type { NativeViteOptions, UserConfig, ViteContext } from "./type";

export const defineLiteConfig = (config: UserConfig): UserConfig => config;
export const defineConfig = defineLiteConfig;

const CONFIG_FILES = [
  "lite.config.ts",
  "lite.config.js",
  "lite.config.mjs",
  "lite.config.cjs",
];

async function loadConfigFile(): Promise<UserConfig | null> {
  for (const file of CONFIG_FILES) {
    const filePath = resolve(ROOT, file);
    if (!existsSync(filePath)) continue;

    log.debug(`\u52A0\u8F7D\u914D\u7F6E\u6587\u4EF6: ${filePath}`);

    try {
      const ext = extname(file);

      if (ext === ".ts") {
        const esbuild = await import("esbuild");
        const result = await esbuild.default.build({
          entryPoints: [filePath],
          bundle: true,
          write: false,
          format: "esm",
          platform: "node",
          target: "esnext",
          external: ["lite-vite"],
        });
        const code = result.outputFiles[0].text
          .replace(/from\s*["']lite-vite["']/g, 'from "data:text/javascript,"');
        const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
        const mod = await import(dataUrl);
        return mod.default || mod;
      }

      if (ext === ".cjs") {
        const mod = require(filePath);
        return mod.default || mod;
      }

      const fileUrl = pathToFileURL(filePath).href;
      const mod = await import(`${fileUrl}?t=${Date.now()}`);
      return mod.default || mod;
    } catch (err: any) {
      log.warn(`\u52A0\u8F7D\u914D\u7F6E\u6587\u4EF6\u5931\u8D25: ${file} - ${err.message}`);
      return null;
    }
  }
  return null;
}

export const loadOptions = async (
  cliOptions: NativeViteOptions
): Promise<ViteContext> => {
  const fileConfig = await loadConfigFile();

  const merged: NativeViteOptions = { ...cliOptions };

  if (fileConfig) {
    if (fileConfig.port && !cliOptions.port) merged.port = fileConfig.port;
    if (fileConfig.server?.port && !cliOptions.port) merged.port = fileConfig.server.port;
    if (fileConfig.output && !cliOptions.output) merged.output = fileConfig.output;
    if (fileConfig.build?.outdir && !cliOptions.output) merged.output = fileConfig.build.outdir;
    if (fileConfig.sourcemap !== undefined && cliOptions.sourcemap === undefined) merged.sourcemap = fileConfig.sourcemap;
    if (fileConfig.build?.sourcemap !== undefined && cliOptions.sourcemap === undefined) merged.sourcemap = fileConfig.build.sourcemap;
    if (fileConfig.format && !cliOptions.format) merged.format = fileConfig.format;
    if (fileConfig.build?.format && !cliOptions.format) merged.format = fileConfig.build.format;
    if (fileConfig.entry) merged.entry = resolve(ROOT, fileConfig.entry);
    if (fileConfig.build) {
      merged.build = {
        ...merged.build,
        ...fileConfig.build,
        outdir: fileConfig.build.outdir || merged.build?.outdir || "dist",
        lib: fileConfig.build.lib || merged.build?.lib,
      } as any;
    }
    if (fileConfig.resolve) merged.resolve = fileConfig.resolve;
    if (fileConfig.define) merged.define = fileConfig.define;
  }

  const userPlugins = fileConfig?.plugins || [];
  const plugins = [...defaultPlugins, ...userPlugins];

  return { ...merged, plugins };
};
